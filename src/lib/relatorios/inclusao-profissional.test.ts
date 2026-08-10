import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deveIncluirNoRelatorio } from './inclusao-profissional.ts';

test('@spec:AC-014 profissional desligado que trabalhou no período continua no relatório', () => {
  const profissional = { ativo: false, temRegistroNoPeriodo: true };
  assert.equal(deveIncluirNoRelatorio(profissional), true);
});

test('@spec:AC-015 profissional desligado sem registro no período some do relatório', () => {
  const profissional = { ativo: false, temRegistroNoPeriodo: false };
  assert.equal(deveIncluirNoRelatorio(profissional), false);
});

test('@spec:AC-016 profissional ativo sem registro no período aparece com zero horas', () => {
  const profissional = { ativo: true, temRegistroNoPeriodo: false };
  assert.equal(deveIncluirNoRelatorio(profissional), true);
});
