# PRD: Adição de Foto do Paciente com Sincronização no Google Drive e Avatar Dinâmico

Atualmente, os pacientes cadastrados no MedGuia Hub são identificados visualmente apenas pelas iniciais de seus nomes (ex.: "JS" para João Silva) exibidas em contêineres coloridos ou circulares. O sistema não permite capturar, fazer upload nem exibir fotos de perfil dos pacientes nas rotas de cadastro (`/pacientes/novo`) e de edição (`/pacientes/[id]/editar`), tampouco exibir a fotografia real nos avatares do Prontuário Digital (`/pacientes/[id]`), na listagem geral (`/pacientes`) e nos cartões de confirmação.

A clínica já conta com a integração nativa com o **Google Drive** ativa e funcional (utilizada para pastas de pacientes, atendimentos e mídias clínicas). A inclusão da foto de perfil deve se conectar diretamente a essa infraestrutura de armazenamento, salvando a imagem na pasta do próprio paciente no Google Drive e vinculando o ID do arquivo ao registro do paciente para exibição rápida e segura do avatar em todo o ecossistema do MedGuia Hub.

---

## Problema (O Porquê)

1. **Risco de Confusão de Identidade e Homônimos:**  
   Em clínicas de fisioterapia e saúde com grande volume de atendimentos diários, pacientes com nomes similares ou homônimos podem ser confundidos pela recepção e pelos profissionais. A ausência de foto no prontuário e na listagem reduz a segurança assistencial.

2. **Atendimento Frio e Pouco Humanizado:**  
   A equipe de recepção e os fisioterapeutas precisam memorizar os rostos dos pacientes ou perguntar nomes repetidamente. Ter a foto visível na ficha e no avatar possibilita um acolhimento imediato pelo nome desde a entrada na clínica.

3. **Subutilização da Infraestrutura Ativa de Google Drive:**  
   O MedGuia Hub já possui integração OAuth2 configurada com o Google Drive, gerenciando pastas automáticas por paciente (`MedGuia - Pacientes / [Nome] [ID]`) e proxy de mídia autenticado (`/api/drive/file/[fileId]`). Guardar as fotos de perfil no Drive aproveita essa estrutura sem onerar cotas de banco de dados ou buckets externos pagos.

4. **Falta de Padronização no Avatar do Paciente:**  
   Cada página implementa sua própria renderização de iniciais com estilos e tamanhos distintos (quadrado 28x28 no prontuário, circular 9x9 na tabela, etc.), sem um componente centralizado preparado para alternar com elegância entre a foto real e o fallback de iniciais.

---

## Usuários (Para Quem)

- **Recepcionista / Atendente:**  
  *"Ao cadastrar um novo paciente (`/pacientes/novo`) ou editar os dados de um paciente existente (`/pacientes/[id]/editar`), quero anexar ou atualizar a foto do paciente de forma simples (upload de arquivo ou captura rápida), visualizando o preview na hora e sabendo que a imagem ficará salva no Drive."*

- **Fisioterapeuta / Especialista Clínico:**  
  *"Ao abrir o prontuário do paciente (`/pacientes/[id]`) ou verificar os atendimentos do dia, quero bater o olho no avatar e reconhecer o paciente de imediato pela fotografia, evitando enganos e agilizando meu atendimento."*

- **Gestor da Clínica:**  
  *"Quero que todas as fotos dos pacientes fiquem centralizadas e organizadas dentro da respectiva pasta do paciente no Google Drive da clínica, mantendo o controle total dos ativos e conformidade com a LGPD através de links autenticados e protegidos."*

---

## Requisitos (O Quê)

---

### 1. Experiência de Upload e Preview no Cadastro (`/pacientes/novo`)

#### 1.1. Interface no Formulário de Cadastro (`FormCadastroPaciente.tsx`)
- Inserir no topo do formulário (antes ou dentro do bloco "Dados Pessoais") o componente interativo de upload de foto do paciente:
  - **Avatar Circular/Arredondado de Destaque:** Tamanho aproximado `w-24 h-24` ou `w-28 h-28`, com visual moderno, borda suave e ícone de câmera/upload.
  - **Estado Vazio (Sem foto):** Exibe ícone de silhueta ou iniciais dinâmicas caso o nome já tenha sido digitado no campo `nome`, com badge de câmera indicando "Adicionar Foto".
  - **Seleção de Imagem:** Permite selecionar arquivos de imagem do dispositivo através de clique ou *drag & drop*.
  - **Formatos Permitidos:** `.jpg`, `.jpeg`, `.png`, `.webp`.
  - **Validação de Tamanho:** Máximo de 10MB por arquivo (com compressão recomendada no cliente antes do envio).
  - **Preview Imediato:** Ao selecionar uma imagem, gera preview instantâneo no componente (via `URL.createObjectURL` ou base64) sem recarregar a página.
  - **Ações Rápidas no Preview:**
    - Botão para **Substituir Foto** (abre novamente o seletor).
    - Botão para **Remover Foto** (limpa a seleção e restaura o avatar vazio).

#### 1.2. Fluxo de Submissão e Criação do Paciente
- Ao enviar o formulário (Server Action `criarPaciente`):
  1. Cria o registro do paciente na tabela `pacientes`.
  2. Garante a existência da pasta do paciente no Google Drive via `criarPastaPaciente(pacienteId, nome)`.
  3. Caso uma foto tenha sido anexada:
     - Realiza o upload da imagem para a pasta do paciente no Google Drive com o nome padronizado `Foto de Perfil - [Nome do Paciente].[ext]`.
     - Obtém o `google_drive_file_id` e a URL do arquivo no Drive.
     - Atualiza os campos `foto_drive_file_id`, `foto_drive_url` e `foto_atualizada_em` na tabela `pacientes`.
     - Opcionalmente registra o arquivo na tabela `paciente_midias` com categoria/tag especial `avatar`.
  4. Redireciona o usuário para `/pacientes` com feedback de sucesso via toast.
- **Resiliência:** Se o Google Drive estiver offline ou temporariamente desconectado, o paciente **deve ser criado normalmente** com os dados textuais, e um aviso (toast de *warning*) deve alertar o operador de que a foto não pôde ser salva no Drive e pode ser reenviada posteriormente.

---

### 2. Experiência de Edição, Substituição e Exclusão (`/pacientes/[id]/editar`)

#### 2.1. Interface no Formulário de Edição (`FormEditarPaciente.tsx`)
- Exibir o componente de foto carregando o estado atual do paciente:
  - Se o paciente já possui `foto_drive_file_id`: renderiza a imagem real utilizando o proxy `/api/drive/file/${paciente.foto_drive_file_id}`.
  - Se não possui foto: exibe o placeholder estilizado com as iniciais do paciente.
- **Interações Disponíveis:**
  - **Alterar Foto:** Abre seletor de arquivo; ao selecionar, atualiza imediatamente o preview local com tag visual de *"Nova foto selecionada (será salva ao atualizar)"*.
  - **Remover Foto Atual:** Se o paciente já possuía foto salva, disponibiliza botão explícito *"Remover Foto"*:
    - Solicita confirmação rápida (ou marcação de remoção).
    - No salvamento, apaga o arquivo anterior no Google Drive (ou move para lixeira do Drive) e define `foto_drive_file_id = NULL`, `foto_drive_url = NULL` no banco.
  - **Manter Foto Atual:** Se o usuário editar outros campos (ex.: telefone, endereço) sem mexer na foto, a foto existente é 100% preservada.

#### 2.2. Submissão na Server Action `editarPaciente`
- Atualizar a Server Action `editarPaciente` em `src/actions/pacientes.ts` para tratar os cenários:
  - **Upload de nova foto:** Envia ao Drive na pasta do paciente, substitui a referência `foto_drive_file_id` e remove o arquivo antigo do Drive para não gerar lixo.
  - **Remoção de foto:** Remove o arquivo do Drive e zera os campos no banco.
  - **Inalterada:** Nenhuma chamada ao Drive é disparada, economizando requisições.
- Revalida os caminhos `/pacientes`, `/pacientes/[id]` e `/pacientes/[id]/editar`.

---

### 3. Integração com o Google Drive e Estrutura de Armazenamento

#### 3.1. Localização e Nomenclatura no Drive
- Toda foto de paciente deve ser salva **dentro da pasta específica daquele paciente** no Google Drive (cujo ID está mapeado em `paciente_pastas_drive.google_drive_folder_id`).
- Se a pasta do paciente ainda não existir no Drive (ex.: paciente legado ou falha na criação inicial), a rotina de upload deve invocar automaticamente `criarPastaPaciente` antes de enviar o arquivo.
- **Nomenclatura Padrão:**  
  `foto_perfil.jpg` ou `foto_perfil_[id_curto].[ext]`.
- **MimeTypes Aceitos:** `image/jpeg`, `image/png`, `image/webp`.

#### 3.2. Funções Especializadas no Backend (`src/actions/google-drive.ts` ou `src/lib/google-drive.ts`)
Criar funções auxiliares dedicadas:
1. `salvarFotoPacienteDrive(pacienteId: string, nomePaciente: string, file: File | Buffer, mimeType: string): Promise<{ fileId: string; fileUrl: string }>`
2. `excluirFotoPacienteDrive(fileId: string): Promise<boolean>`
3. Utilizar as permissões já concedidas pelo OAuth2 (`https://www.googleapis.com/auth/drive`).

---

### 4. Segurança, LGPD e Proxy de Imagem

#### 4.1. Privacidade e Acesso Autenticado (Sem Links Públicos)
- Fotos de pacientes são dados biométricos e pessoais sensíveis sob a LGPD (Lei Geral de Proteção de Dados).  
- **NUNCA** tornar os arquivos de fotos públicos na internet no Google Drive (não utilizar permissões públicas `anyoneWithLink`).
- A exibição das fotos no frontend deve consumir o proxy seguro já existente na aplicação:  
  `GET /api/drive/file/[fileId]`
  - Esse endpoint valida a sessão do usuário autenticado no MedGuia Hub via Supabase Auth.
  - Caso o usuário não esteja logado, o acesso é bloqueado com status HTTP 401.

#### 4.2. Performance e Cache HTTP
- O endpoint `/api/drive/file/[fileId]` já entrega cabeçalhos de cache:  
  `Cache-Control: private, max-age=3600`
- Para evitar que o avatar recarregue a imagem do Drive a cada troca de tela ou renderização de lista:
  - Aproveitar o cache do navegador.
  - Adicionar controle de versão na URL da imagem quando atualizada:  
    `/api/drive/file/${fileId}?v=${paciente.foto_atualizada_em || ''}`.

---

### 5. Componente Unificado: `AvatarPaciente`

Criar um componente reutilizável em `src/components/features/pacientes/AvatarPaciente.tsx` para padronizar todos os avatares de pacientes do sistema.

#### 5.1. Propriedades (Props)
```typescript
interface AvatarPacienteProps {
  nome: string
  fotoDriveFileId?: string | null
  fotoAtualizadaEm?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  isAtivo?: boolean
  mostrarStatus?: boolean
  className?: string
  priority?: boolean
}
```

#### 5.2. Comportamento do Componente
- **Com Foto:**
  - Renderiza `<img />` apontando para `/api/drive/file/${fotoDriveFileId}?v=...`.
  - Tratamento nativo de `onError`: caso a imagem falhe no carregamento (ex.: arquivo excluído no Drive ou problema de rede), alterna instantaneamente para o fallback de iniciais sem quebrar o layout.
  - Efeito de carregamento com *skeleton* suave enquanto a imagem carrega.
- **Sem Foto (Fallback):**
  - Renderiza as duas primeiras iniciais do nome do paciente em caixa alta.
  - Cor de fundo consistente e agradável (utilizando a paleta já consolidada no projeto ou a cor corporativa `#006b5a`).
- **Badge de Status (Ativo / Inativo):**
  - Quando `mostrarStatus = true`, exibe o pontinho indicador:
    - Verde (`#25D366`) para paciente ativo.
    - Vermelho para inativo.

---

### 6. Onde o Avatar do Paciente Deve Aparecer

Após a implementação da persistência e do componente, atualizar os seguintes pontos da aplicação:

1. **Prontuário Digital (`/pacientes/[id]/page.tsx`):**
   - Substituir o bloco estático das iniciais (linhas 374-383) pelo `AvatarPaciente` com `size="2xl"` (ou dimensões equivalentes a `w-28 h-28 rounded-3xl`), preservando o badge de status e o design refinado.

2. **Listagem Geral de Pacientes (`/pacientes/page.tsx`):**
   - **Tabela Desktop:** Atualizar a célula de identificação (linha 106) para usar `AvatarPaciente` com `size="sm"` (`w-9 h-9`).
   - **Visualização em Cards / Mobile:** Atualizar o cabeçalho do card (linha 175) para usar `AvatarPaciente` com `size="md"` (`w-10 h-10`).

3. **Cartões de Confirmação (`CardConfirmacaoPaciente.tsx`):**
   - Atualizar a exibição das iniciais (linha 139) para `AvatarPaciente`.

4. **Formulários de Gestão (`FormCadastroPaciente.tsx` e `FormEditarPaciente.tsx`):**
   - Exibir o `AvatarPaciente` interativo com gatilhos de edição/upload.

---

### 7. Modelo de Dados e Migração SQL

#### 7.1. Alteração na Tabela `pacientes`
Arquivo de migração: `database/pacientes_foto_drive_migration.sql`

```sql
-- Adiciona colunas para foto do paciente sincronizada com Google Drive
ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS foto_drive_file_id TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS foto_drive_url TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS foto_atualizada_em TIMESTAMPTZ DEFAULT NULL;

-- Índice para consultas e integridade
CREATE INDEX IF NOT EXISTS idx_pacientes_foto_drive_file_id
  ON public.pacientes(foto_drive_file_id)
  WHERE foto_drive_file_id IS NOT NULL;

-- Comentários explicativos
COMMENT ON COLUMN public.pacientes.foto_drive_file_id IS 'ID do arquivo de imagem do paciente no Google Drive';
COMMENT ON COLUMN public.pacientes.foto_drive_url IS 'URL webViewLink do arquivo de imagem no Google Drive';
COMMENT ON COLUMN public.pacientes.foto_atualizada_em IS 'Data e hora da última alteração da foto de perfil';
```

---

## NUNCA PODE:

- **NUNCA** salvar a foto do paciente em base64 diretamente dentro do banco PostgreSQL (isso incha o banco e degrada severamente a performance de listagens e backups).
- **NUNCA** tornar os arquivos de foto no Google Drive com permissão pública irrestrita (`anyoneWithLink`). O acesso deve ser mediado exclusivamente pelo endpoint de proxy autenticado `/api/drive/file/[fileId]`.
- **NUNCA** travar a criação ou edição textual do paciente caso o Google Drive apresente lentidão, cota excedida ou token expirado. O fluxo de dados clínicos tem prioridade; o upload de foto deve ter tratamento gracioso de falhas com mensagens claras para o usuário.
- **NUNCA** deixar o layout "piscar" com imagem quebrada clássica do navegador caso a URL do Drive falhe. O fallback para as iniciais deve ser automático via evento `onError`.
- **NUNCA** permitir upload de arquivos executáveis ou tipos que não sejam imagens (validar estritamente MIME types no cliente e no servidor: `image/jpeg`, `image/png`, `image/webp`).
- **NUNCA** manter arquivos órfãos no Google Drive ao substituir uma foto de paciente; ao salvar uma nova foto, a foto antiga anterior deve ser removida do Drive.

---

## Métricas de Sucesso

- **100%** das novas fotos salvas com segurança no Google Drive dentro da pasta do respectivo paciente.
- **Zero** incidentes de exposição pública de imagens clínicas sensíveis (100% de conformidade com LGPD via proxy autenticado).
- **Tempo de upload** perceptível pelo usuário inferior a **2 segundos** em conexões padrão de banda larga.
- **Taxa de fallback sem falhas:** 100% dos pacientes sem foto ou com falha temporária de rede exibindo iniciais legíveis e estilizadas sem quebra de tela.
- **Adoção:** Mais de **70%** dos novos cadastros contendo foto do paciente após o primeiro mês de liberação da funcionalidade.

---

## Fora do Escopo (V1)

- Ferramenta avançada de corte manual (*crop tool* com rotação e zoom) no navegador (na V1, a imagem será ajustada automaticamente via CSS `object-fit: cover` mantendo proporções circulares/quadradas).
- Reconhecimento facial automático de pacientes.
- Captura direta via webcam integrada no navegador (o usuário utilizará o seletor padrão do sistema operacional, que em dispositivos móveis/tablets já permite abrir a câmera nativa).
- Sincronização retroativa em lote para buscar fotos de redes sociais (WhatsApp/Instagram).

---

## Roteiro de Implementação Sugerido

| Etapa | Ação | Arquivos Envolvidos |
| :--- | :--- | :--- |
| **1. Banco** | Criar e executar a migração SQL com as novas colunas na tabela `pacientes` | `database/pacientes_foto_drive_migration.sql` |
| **2. Drive API** | Implementar funções para upload e exclusão de foto de perfil no Google Drive | `src/lib/google-drive.ts`, `src/actions/google-drive.ts` |
| **3. Componente** | Criar componente universal `AvatarPaciente` com suporte a imagem, proxy, fallback e status | `src/components/features/pacientes/AvatarPaciente.tsx` |
| **4. Cadastro** | Adicionar seletor/preview de foto no formulário de novo paciente e atualizar a Server Action | `FormCadastroPaciente.tsx`, `src/actions/pacientes.ts` |
| **5. Edição** | Adicionar visualização, troca e remoção de foto na tela de edição do paciente | `FormEditarPaciente.tsx`, `src/actions/pacientes.ts` |
| **6. Visualização**| Atualizar Prontuário Digital (`/pacientes/[id]`), Listagem (`/pacientes`) e Cards | `pacientes/[id]/page.tsx`, `pacientes/page.tsx`, `CardConfirmacaoPaciente.tsx` |
