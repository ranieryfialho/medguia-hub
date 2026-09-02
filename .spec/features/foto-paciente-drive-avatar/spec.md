# Spec: Foto do paciente com Google Drive e avatar dinâmico

> feature: foto-paciente-drive-avatar
> status: rascunho

## Contexto

O MedGuia Hub identifica pacientes só por iniciais em 9 pontos de renderização (8 hoje + agenda). Com 9.632 pacientes ativos, homônimos são rotina e a conferência de identidade é verbal. Esta feature adiciona foto de perfil ao paciente, sincronizada com a pasta do paciente no Google Drive (repositório oficial de mídia da clínica), servida por um proxy autenticado (nunca link público), e exibida por um componente único de avatar em todas as telas relevantes — incluindo dia/semana da agenda.

Decisão de arquitetura (RFC 006, Opção 1 aprovada 2026-09-02): a foto é um recurso com ciclo de vida próprio, fora do `<form>` de cadastro/edição — comprimida no cliente (lado maior 1024px, WebP/JPEG), enviada por rota dedicada (`POST/DELETE /api/pacientes/[id]/foto`), nunca bloqueando a criação/edição textual do paciente. Design técnico completo em [TDD 006](../../../docs/tdds/006-foto-do-paciente-google-drive-e-avatar.md); este spec.md é a camada auditável (critérios → testes) sobre esse design, não uma reescrita dele.

## Histórias

### US-026 — Recepcionista anexa foto ao cadastrar paciente

Como recepcionista, quero anexar a foto do paciente ao cadastrá-lo, para que a equipe reconheça o paciente visualmente desde o primeiro atendimento.

#### AC-087 — Preview imediato ao selecionar imagem válida

- **Dado** que a recepcionista está no formulário de cadastro de paciente
- **Quando** ela seleciona um arquivo `.jpg`, `.jpeg`, `.png` ou `.webp` de até 10MB
- **Então** o preview da imagem aparece imediatamente no avatar do formulário, sem recarregar a página

#### AC-088 — Foto é enviada ao Drive após o paciente ser criado com sucesso

- **Dado** que a recepcionista preencheu o formulário e selecionou uma foto válida
- **Quando** ela envia o formulário e o paciente é criado com sucesso
- **Então** a foto é enviada para a pasta do paciente no Google Drive e os campos `foto_drive_file_id` e `foto_atualizada_em` do paciente são preenchidos

#### AC-089 — Cadastro conclui mesmo com o Google Drive indisponível

- **Dado** que o Google Drive está desconectado, com token expirado ou retornando erro
- **Quando** a recepcionista cadastra um paciente com foto anexada
- **Então** o paciente é criado normalmente com os dados textuais, um aviso informa que a foto não pôde ser salva e pode ser reenviada depois, e a navegação segue normalmente

#### AC-090 — Arquivo que não é imagem de verdade é rejeitado

- **Dado** que um arquivo tem extensão/MIME de imagem mas seu conteúdo real não é `image/jpeg`, `image/png` nem `image/webp` (verificado pelos bytes do arquivo, não pelo nome)
- **Quando** o upload da foto é tentado
- **Então** a rota rejeita o arquivo com erro 400, sem salvar nada no Drive nem no banco

#### AC-091 — Arquivo acima do limite é rejeitado pelo servidor

- **Dado** um arquivo de imagem válido acima de 2MB chegando na rota de foto
- **Quando** o upload é tentado
- **Então** a rota rejeita com erro 400, independentemente do que o cliente declarou

### US-027 — Recepcionista troca ou remove a foto ao editar o paciente

Como recepcionista, quero trocar ou remover a foto de um paciente já cadastrado, para manter o cadastro atualizado sem duplicar arquivos no Drive.

#### AC-092 — Trocar a foto substitui o arquivo anterior no Drive

- **Dado** um paciente que já possui foto salva
- **Quando** a recepcionista seleciona uma nova foto e ela é salva com sucesso
- **Então** o novo arquivo é enviado, o `foto_drive_file_id` do paciente passa a apontar para ele, e o arquivo anterior deixa de existir no Drive (nenhum arquivo órfão)

#### AC-093 — Remover a foto limpa o cadastro e o Drive

- **Dado** um paciente que já possui foto salva
- **Quando** a recepcionista confirma a remoção da foto
- **Então** o arquivo é movido para a lixeira do Drive e os campos `foto_drive_file_id` e `foto_atualizada_em` do paciente voltam a `NULL`

#### AC-094 — Editar outros campos não mexe na foto

- **Dado** um paciente com foto salva
- **Quando** a recepcionista edita telefone ou endereço sem tocar no campo de foto
- **Então** a foto existente é 100% preservada e nenhuma chamada é feita ao Google Drive

#### AC-095 — Remover foto de paciente sem foto é idempotente

- **Dado** um paciente sem foto (`foto_drive_file_id` nulo)
- **Quando** a remoção de foto é solicitada para esse paciente
- **Então** a resposta é de sucesso (não é tratada como erro), sem tentar apagar nada no Drive

### US-028 — Qualquer usuário autenticado reconhece o paciente pelo avatar

Como fisioterapeuta ou recepcionista, quero ver a foto real do paciente (ou iniciais legíveis quando não houver foto), para reconhecê-lo com segurança em qualquer tela do sistema.

#### AC-096 — Avatar mostra a foto real quando ela existe

- **Dado** um paciente com `foto_drive_file_id` preenchido
- **Quando** o componente de avatar é renderizado
- **Então** ele exibe a imagem vinda do proxy autenticado do Drive, respeitando o tamanho (`size`) pedido

#### AC-097 — Avatar mostra iniciais quando não há foto

- **Dado** um paciente sem `foto_drive_file_id` (nulo ou vazio)
- **Quando** o componente de avatar é renderizado
- **Então** ele exibe as duas primeiras iniciais do nome do paciente em caixa alta, sem tentar carregar nenhuma imagem

#### AC-098 — Falha ao carregar a imagem cai para iniciais sem quebrar a tela

- **Dado** um avatar renderizando uma foto cujo arquivo foi excluído do Drive ou está inacessível
- **Quando** o carregamento da imagem falha (evento `onError`)
- **Então** o avatar alterna automaticamente para o fallback de iniciais, sem exibir o ícone de imagem quebrada do navegador e sem alterar o layout

#### AC-099 — Trocar a foto invalida o cache do navegador

- **Dado** um paciente cuja foto acabou de ser trocada (`foto_atualizada_em` mudou)
- **Quando** o avatar é renderizado novamente em qualquer tela
- **Então** a URL da imagem inclui o novo valor de `foto_atualizada_em` como parâmetro de versão, forçando o navegador a buscar a imagem nova em vez de servir a antiga do cache

### US-029 — Fisioterapeuta amplia a foto para conferir identidade

Como fisioterapeuta, quero clicar na foto do paciente no prontuário para vê-la ampliada, para confirmar a identidade antes de um atendimento.

#### AC-100 — Clicar no avatar com foto e ampliação habilitada abre a visualização ampliada

- **Dado** um avatar com foto e a propriedade `ampliavel` ativada (prontuário digital, card de confirmação, prontuário de atendimento)
- **Quando** o usuário clica no avatar
- **Então** a foto abre em visualização ampliada (lightbox)

#### AC-101 — Avatar sem foto não é clicável mesmo com ampliação habilitada

- **Dado** um avatar sem foto (mostrando iniciais) com `ampliavel` ativada
- **Quando** o usuário tenta clicar
- **Então** nada acontece — não há visualização ampliada de iniciais

### US-030 — Sistema nunca expõe foto de paciente publicamente

Como gestor da clínica, quero garantir que nenhuma foto de paciente fique acessível sem autenticação, para manter conformidade com a LGPD.

#### AC-102 — Leitura da foto exige sessão autenticada

- **Dado** uma requisição para o proxy de leitura de arquivo do Drive sem sessão válida do MedGuia Hub
- **Quando** a requisição é feita
- **Então** o acesso é bloqueado com status HTTP 401

#### AC-103 — Nenhuma permissão pública é criada no arquivo salvo

- **Dado** uma foto de paciente recém-salva no Google Drive
- **Quando** o arquivo é consultado por sua lista de permissões
- **Então** o arquivo não possui nenhuma permissão do tipo `anyoneWithLink` ou pública — apenas a herdada da pasta do paciente

### US-031 — Fisioterapeuta vê o avatar do paciente na agenda

Como fisioterapeuta, quero ver a foto do paciente diretamente nos agendamentos do dia e da semana, para reconhecê-lo antes de recebê-lo.

#### AC-104 — Avatar aparece nos itens de agendamento das views dia e semana

- **Dado** um agendamento de um paciente com foto cadastrada
- **Quando** a agenda é exibida nas views dia ou semana
- **Então** o item do agendamento mostra o avatar do paciente (foto ou iniciais)

#### AC-105 — View mês não recebe avatar

- **Dado** a agenda exibida na view mês
- **Quando** a tela é renderizada
- **Então** nenhum avatar de paciente é exibido nos itens — o comportamento permanece igual ao anterior à feature

#### AC-106 — Avatares da agenda carregam sem bloquear a renderização

- **Dado** os itens de agenda das views dia e semana com avatar
- **Quando** a agenda é renderizada
- **Então** todo avatar usa carregamento `lazy` (nenhum usa `priority`)

### US-032 — Cadastro de paciente não trava nem se comporta de forma ambígua ao mudar de redirect para retorno de id

Como recepcionista, quero que o cadastro de paciente continue funcionando exatamente como antes nos casos de CPF duplicado e possível duplicidade, mesmo com a mudança técnica que passou a devolver o id do paciente em vez de redirecionar direto do servidor.

#### AC-107 — Cadastro bem-sucedido devolve o id do paciente

- **Dado** dados válidos e não-duplicados de um novo paciente
- **Quando** o formulário de cadastro é enviado
- **Então** a ação de criar paciente retorna o id do paciente criado (sem redirecionar do servidor), permitindo que o cliente prossiga com o upload da foto antes de navegar

#### AC-108 — CPF duplicado não retorna id de paciente nem tenta subir foto

- **Dado** um CPF que já pertence a outro paciente cadastrado
- **Quando** o formulário de cadastro é enviado com esse CPF
- **Então** a ação retorna um erro de duplicidade, sem `pacienteId`, sem criar o paciente e sem tentar enviar a foto ao Drive

#### AC-109 — Candidato a duplicado por nome não retorna id de paciente nem tenta subir foto

- **Dado** um nome semelhante a um paciente já cadastrado, que dispara a checagem de possível duplicidade
- **Quando** o formulário de cadastro é enviado
- **Então** a ação retorna o estado de confirmação de duplicado, sem `pacienteId` e sem enviar foto ao Drive

#### AC-110 — Criação do paciente aguarda a pasta do Drive antes de retornar

- **Dado** um paciente sendo criado (inclusive um cujo cadastro ficaria entre os que hoje ficam sem pasta no Drive)
- **Quando** a ação de criar paciente termina com sucesso
- **Então** a pasta do paciente no Google Drive já existe (a criação foi aguardada, não disparada em fire-and-forget) antes de qualquer upload de foto ser tentado

### US-033 — Sistema mantém o Google Drive livre de fotos órfãs

Como gestor da clínica, quero que arquivos de foto que ficaram sem paciente vinculado (ex.: falha ao apagar o anterior numa troca) sejam removidos automaticamente, para não acumular lixo na pasta de pacientes do Drive.

#### AC-111 — Rotina automática remove arquivos órfãos detectados

- **Dado** um `fileId` de foto antiga registrado no log de falha de limpeza (a troca de foto salvou a nova mas não conseguiu apagar a antiga)
- **Quando** a rotina automática de limpeza de órfãos roda
- **Então** o arquivo órfão é removido do Google Drive e deixa de constar como pendente de limpeza

### US-034 — Foto do paciente é excluída automaticamente ao inativar por óbito

Como gestor da clínica, quero que a foto de um paciente seja removida do Drive quando ele é inativado por óbito, para respeitar o ponto de retenção de dado sensível da LGPD nesse caso específico.

#### AC-112 — Inativação por óbito remove a foto do paciente

- **Dado** um paciente ativo com foto salva
- **Quando** a recepção o inativa marcando o motivo como óbito (fluxo já existente de inativação, com a marcação de óbito)
- **Então** a foto é removida do Google Drive e os campos `foto_drive_file_id` e `foto_atualizada_em` do paciente voltam a `NULL`, no mesmo salvamento da inativação

#### AC-113 — Paciente inativo por outro motivo continua exibindo a foto normalmente

- **Dado** um paciente inativado por um motivo que não é óbito, e que possui foto salva
- **Quando** o avatar desse paciente é exibido em qualquer tela
- **Então** a foto aparece normalmente, com o badge de status vermelho de inativo — nenhuma mudança de comportamento em relação a um paciente ativo com foto

## Fora de escopo

- Ferramenta de recorte manual (crop/rotação/zoom) no navegador — ajuste via `object-fit: cover`.
- Captura direta por webcam (usa-se o seletor nativo do sistema operacional).
- Reconhecimento facial e importação retroativa de fotos de redes sociais.
- Registro da foto em `paciente_midias` (Decisão B da RFC).
- Coluna `foto_drive_url` / `webViewLink` no banco (Decisão A da RFC).
- Avatar na view mês da agenda (Decisão F, mitigação 2).
- Endurecer a autorização do proxy `/api/drive/file/[fileId]` para validar posse do `fileId` por paciente (Decisão C da RFC — item separado, registrado como limitação conhecida).
- Backfill em lote dos 572 pacientes sem pasta no Drive (são absorvidos sob demanda, no primeiro upload de foto).
- Foto obrigatória no cadastro (Decisão D — permanece opcional).

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-020 | 1024px de lado maior é resolução suficiente tanto para o maior avatar quanto para a ampliação em modal | confirmada | RFC 006, Premissa 2 — aprovado pelo Approver em 2026-09-02 |
| ASM-021 | Todo usuário autenticado do Hub pode ver a foto de qualquer paciente (não há segregação por profissional/carteira hoje) | aberta | RFC 006, Premissa 3 — confiança "Média"; se cair, a Decisão C vira bloqueante |
| ASM-022 | Navegadores usados pela recepção suportam `canvas.toBlob` com WebP; onde não suportarem, cai para JPEG | confirmada | RFC 006, Premissa 5 — fallback JPEG cobre o caso |
| ASM-023 | Foto de paciente inativo continua aparecendo normalmente, exceto quando a inativação é por óbito (AC-112) | confirmada | Decidido com @Dr. Felipe em 2026-09-02 (ver AC-112/AC-113) |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| Q-011 | Arquivo órfão detectado no log (falha ao apagar o anterior) tem rotina de limpeza automática ou é tratamento manual? | respondida | Rotina automática (ver US-033/AC-111) — decidido com @Dr. Felipe em 2026-09-02 |
| Q-012 | A foto do paciente deve ser excluída automaticamente ao inativá-lo por óbito? | respondida | Sim, exclusão automática no mesmo salvamento da inativação (ver US-034/AC-112) — decidido com @Dr. Felipe em 2026-09-02 |
| Q-013 | Qual é a fonte/metodologia da medição de baseline de performance da agenda (dia cheio, views dia/semana/mês) usada para decidir se o avatar na agenda se mantém? | aberta | — |
