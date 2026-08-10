# PRD: Módulo de Ponto Eletrônico com Geolocalização

Atualmente, o controle de jornada dos funcionários CLT em nossas operações depende de processos sujeitos a falhas. O RH gasta aproximadamente 1 hora semanal apurando registros incorretos, e 15% a 20% das marcações apresentam erros por rasura em qualquer registro, o que gera insegurança jurídica e possíveis passivos trabalhistas com o não cumprimento rigoroso da legislação.

## Problema (O Porquê)

A funcionalidade precisa ser construída porque, atualmente, o controle de jornada dos funcionários CLT em nossas operações depende de processos sujeitos a falhas. O RH gasta aproximadamente 1 hora semanal apurando registros incorretos, e 15% a 20% das marcações apresentam inconsistências. Isso gera insegurança jurídica e possíveis passivos trabalhistas com o não cumprimento rigoroso da legislação.

## Usuários (Para Quem)

- **Funcionário CLT:** "Quero bater meu ponto pelo celular de forma rápida, ter o comprovante seguro de que cumpri minha jornada e ter uma tela onde eu possa visualizar facilmente meu histórico de horários."
- **Gestor / Recursos Humanos:** "Quero ter certeza de que o funcionário estava fisicamente no local de trabalho na hora em que o ponto foi registrado e acessar uma área administrativa centralizada para acompanhar os dados de toda a minha equipe." 

## Requisitos (O Quê)

- O sistema deve permitir o registro dos horários de entrada, pausas e saída utilizando o GPS do aparelho celular do colaborador de forma simples e rápida.  
- O sistema deve apresentar um extrato/histórico de fácil acesso para o colaborador conferir seus próprios registros diários e semanais. 
- O sistema deve disponibilizar um painel (área administrativa) para os gestores visualizarem os registros de ponto e o status de geolocalização de seus subordinados.
- O sistema deve possuir um fluxo de justificativa de faltas, incluindo um campo que permita ao colaborador fazer o upload de atestados médicos ou comprovantes (em formato PDF ou foto).
- O sistema deve exigir validação mútua (aprovação obrigatória tanto do gestor quanto do funcionário) para o cômputo e confirmação das horas extras.
- O sistema deve contemplar um fluxo de liberação de ponto remoto (para trabalho fora do raio padrão da empresa), que deve ser concedido com uma data de validade pré-estabelecida.

## NUNCA PODE:

- Aceitar a marcação de ponto se a localização do funcionário estiver fora do raio permitido do seu local de trabalho (exceto nos casos de ponto remoto liberado).  
- Concluir o registro se o GPS do aparelho estiver desativado ou com baixa precisão. 
- Permitir que o funcionário faça alterações manuais retroativas nos horários já registrados no seu histórico.
- Permitir o registro ou aceitar a contabilização de mais de 2 horas extras por dia para qualquer funcionário.

## Métricas
- % de registros de ponto validados automaticamente pela geolocalização, sem necessidade de auditoria manual.  
- Redução da taxa de inconsistências na folha de ponto para menos de 2%. 
- Tempo de confirmação do registro na tela do usuário menor que 3 segundos.

## Fora do Escopo (V1)
O que fica de fora é tão importante quanto o que entra, para evitar uma funcionalidade infinita:  
- Biometria ou reconhecimento facial no momento da marcação do ponto.  
- Integração automatizada direta com softwares externos de contabilidade (nesta V1, a área administrativa apenas exportará os relatórios/espelhos de ponto).  
- Cálculos complexos de projeção de banco de horas ou relatórios preditivos de horas extras."""
