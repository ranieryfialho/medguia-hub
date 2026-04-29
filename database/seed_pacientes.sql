-- =========================================================
-- SEED: Pacientes extraídos de lista_consultas.xlsx
-- Total: 373 pacientes únicos
-- Dedup: por CPF (quando disponível) ou por nome exato
-- Não requer UNIQUE constraint na tabela
-- Execute no Supabase SQL Editor (Dashboard > SQL Editor)
-- =========================================================

INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'JOAO CAETANO CALONI ZANIN', NULL, '(85) 9 9901-8488', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'JOAO CAETANO CALONI ZANIN' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'DINDJA MARIA BEZERRA LOPES GOMES', '218.536.733-15', '(85) 9 8705-7370', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '218.536.733-15');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARIA TEREZA SILVA DE SOUSA', '261.329.663-15', '(85) 9 9911-7511', 'mariatereza.ssousa@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '261.329.663-15');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'CARLOS GEORGE B LANDIM', '527.782.903-20', '(85) 9 8757-5185', 'george.landim.ce@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '527.782.903-20');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'RAPHAEL MERRERI SAMPAIO', NULL, '(85) 9 9244-8392', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'RAPHAEL MERRERI SAMPAIO' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'WILSON MENDES BARROSO', '682.151.693-68', '(85) 9 9986-1458', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '682.151.693-68');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MURILO TORRES DE MELO PEDROSA', NULL, '(85) 9 8685-6249', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'MURILO TORRES DE MELO PEDROSA' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'LUISA ARAUJO MARTINS', '058.564.333-43', '(85) 9 9780-1210', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '058.564.333-43');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'JOSE NOGUEIRA COSTA', '548.616.408-49', '(85) 9 8815-1039', 'mazimnogueira@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '548.616.408-49');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'VERA LUCIA DE SOUSA', '358.098.333-49', '(85) 9 9963-2207', 'vera.taba@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '358.098.333-49');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'CASSANDRA BATISTA CAVALCANTE', NULL, '(85) 9 9987-0025', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'CASSANDRA BATISTA CAVALCANTE' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'SILVIA  HELENA ROCHA FREITAS', '727.448.553-91', '(85) 9 9854-4350', 'silviah.rocha@hotmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '727.448.553-91');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'JOSE DIMAS DINIZ RUFINO', '372.140.201-49', '(85) 9 9944-1800', 'dimasrufino@gmai.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '372.140.201-49');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'VALDISIA MOREIRA POSSIDÔNIO', NULL, '(85) 9 9988-0543', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'VALDISIA MOREIRA POSSIDÔNIO' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'CRISTIANO N. FERREIRA GOMES', NULL, '(85) 9 8711-4191', 'cristianofgomes@globo.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'CRISTIANO N. FERREIRA GOMES' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'OTILIA MARIA FREIRE ARRAIS', '243.703.473-00', '(85) 9 9629-2629', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '243.703.473-00');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARIA DA CONCEIÇÃO  BATISTA DE SOUZA', NULL, '(85) 9 9789-6072', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'MARIA DA CONCEIÇÃO  BATISTA DE SOUZA' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ANTONIA AURICELIA SOUZA FURTADO', '035.640.163-41', '(85) 9 8893-3744', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '035.640.163-41');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ARICLECIO CAVALCANTI VALENÇA COUTINHO', '053.842.764-79', '(81) 9 9514-2843', 'ariclecio.cavalcanti@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '053.842.764-79');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARIA DO SOCORRO ROCHA MARTINS', '072.610.633-04', '(85) 9 8793-3636', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '072.610.633-04');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'BRUNO MARINHO CAVALCANTE', '035.412.303-39', '(85) 9 9821-9932', 'b.civil.@hotmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '035.412.303-39');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'CRISLENE SUZAMILA BEZERRA PEREIRA NUNES', '017.754.423-65', '(85) 9 8735-7076', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '017.754.423-65');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'JUDITE MARIA AGUIAR FEIJÓ GRANJA', NULL, '(85) 9 8404-4638', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'JUDITE MARIA AGUIAR FEIJÓ GRANJA' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARIA CLEIDE BRINDEIRO SILVA', '472.844.713-87', '(85) 9 8660-1600', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '472.844.713-87');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'RODRIGO DE LIMA ARAGÃO', '062.249.783-95', '(85) 9 9980-9520', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '062.249.783-95');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'VINICIUS DE CASTRO ALVES SAMAPIO', NULL, '(85) 9 9406-0374', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'VINICIUS DE CASTRO ALVES SAMAPIO' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'DANIEL  OLIVEIRA GOMES', '816.811.005-68', '(85) 9 9922-6191', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '816.811.005-68');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'JANILSON DA SILVA  SPNOSA', '006.783.063-38', '(85) 9 9669-4171', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '006.783.063-38');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARIA ONEIDE MARINHO BEZERRAS', '132.871.094-72', '(85) 9 9630-4090', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '132.871.094-72');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARIA AUREA ALVES BESERRA', '390.014.153-34', '(85) 9 9654-3157', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '390.014.153-34');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'PAULO CESAR BARBOSA DE SENA', NULL, '(85) 9 9949-3789', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'PAULO CESAR BARBOSA DE SENA' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'JULIO YURI RODRIGUES  ROLIM', '036.055.263-30', '(85) 9 9748-4512', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '036.055.263-30');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'AMANDA HOLANDA ALMEIDA', '000.752.183-99', '(85) 9 9732-1802', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '000.752.183-99');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'CARLOS RENATO LIMA RODRIGUES', '667.059.753-34', '(85) 9 8701-0198', 'c.renato@yahoo.com.br', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '667.059.753-34');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'IVANIA DANIEL MAIA', '689.386.083-87', '(88) 9 9624-8499', 'ivaniadanielmaia@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '689.386.083-87');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARIA DAS NEVES FIGUEIREDO VAGAS', '113.863.802-10', '(85) 9 8855-2793', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '113.863.802-10');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'DIANA KAREN DE OLIVEIRA MAIA', '032.434.723-50', '(85) 9 8743-0051', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '032.434.723-50');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ALESSANDRA OLIVEIRA VIEIRA', '079.077.043-16', '(85) 9 9936-0795', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '079.077.043-16');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ENZO  OLIVEIRA DE ANDRADE MENDONÇA LIMA', '004.615.463-96', '(85) 9 8810-5009', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '004.615.463-96');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'RAIMUNDA NONATA SOARES', '999.183.313-72', '(85) 9 9429-8396', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '999.183.313-72');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'CARLOS ALBERTO PIRES PASSOS', '090.340.888-04', '(19) 9 9287-0226', 'albrto.passos@uol.com.br', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '090.340.888-04');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'FLAVIA MAYANE MOURA DE LIMA', '058.937.083-93', '(88) 9 9785-1864', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '058.937.083-93');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'PEDRO FERREIRA MESQUITA FILHO', '662.014.113-72', '(85) 9 9616-1452', 'pedromesquita@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '662.014.113-72');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'CREUZA DE LIMA ARAGÃO', '246.203.433-15', '(85) 8 5980-9520', 'creuza.i.aragao@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '246.203.433-15');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARCIA GURGEL CARLOS  ADEODATO', '061.354.803-59', '(85) 9 9973-0652', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '061.354.803-59');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'LUCAS PINHEIRO UCHOA DUTRA', '049.656.883-33', '(85) 9 8860-5522', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '049.656.883-33');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'BRUNO RICART DOMICIANO', '019.424.963-89', '(85) 9 9191-4226', 'brunordomiciliano@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '019.424.963-89');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARIA ELINE NOGUEIRA DE OLIVEIRA', '645.712.113-68', '(85) 9 8173-9699', 'alinenog4@hotmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '645.712.113-68');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARIA LAURA TEIXEIRA GURGEL', '059.388.643-72', '(85) 9 8858-1296', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '059.388.643-72');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'FLAVIO HENRIQUE FERREIRA DA SILVA', '509.760.013-49', '(85) 9 8524-7282', 'flaviopeixevivo@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '509.760.013-49');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'CARLOS NEY ALENCAR DE ARAUJO', '020.624.743-50', '(85) 9 9629-3581', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '020.624.743-50');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'BIANCA CORTEZ MOTA', NULL, '(85) 9 9701-0810', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'BIANCA CORTEZ MOTA' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'CRISLEY ELLEN DA SILVA NASCIMENTO', '629.747.973-93', '(85) 9 9611-6461', 'crisleyens2@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '629.747.973-93');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'RAFAELA DOS SANTOS PEREIRA', '039.610.683-80', '(85) 9 8793-4798', 'professorafaelasantos207gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '039.610.683-80');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'LUIS EDUARDO GONÇALVES GOMES', NULL, '(85) 9 8153-6640', 'gomes.luisdudug@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'LUIS EDUARDO GONÇALVES GOMES' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'FRANCISCO ALVES DOS SANTOS', NULL, '(85) 9 8849-2970', 'cristianomoura001@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'FRANCISCO ALVES DOS SANTOS' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'YASMIN YEDA FERNANDES SOARES', '131.199.764-40', '(85) 9 8860-2063', 'alyneff20@gmai.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '131.199.764-40');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'GABRIELA PESSOA MARQUES LIMA', '065.442.953-70', '(85) 9 8897-6935', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '065.442.953-70');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'FRANCISCA LEITE ALVES', '744.716.513-15', '(85) 9 8885-2808', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '744.716.513-15');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARIA DANIELA SANTABAIA CAVALCANTI', '389.159.443-72', '(85) 9 9987-3126', 'mdaniela@unifor.br', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '389.159.443-72');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'THEO PESSOA ONOFRE', '033.240.084-09', '(85) 9 8787-4887', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '033.240.084-09');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'AURORA RENDA KAJDACSY BALLA DE TILLIO', '104.428.403-06', '(85) 9 9961-8300', 'guigaofta@hotmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '104.428.403-06');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARINA SANTIAGO  MACIEL', '058.966.773-40', '(85) 9 8798-1697', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '058.966.773-40');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARGARIDA MARIA OLIVEIRA DA SILVA', NULL, '(85) 9 9170-1010', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'MARGARIDA MARIA OLIVEIRA DA SILVA' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'RAIMUNDO HILTON PEREIRA LIMA', '122.357.253-68', '(85) 9 9973-6720', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '122.357.253-68');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'POTIGUARA FILHO', NULL, '(85) 9 9633-9777', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'POTIGUARA FILHO' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'RITA CELIA MONTENEGRO CAVALCANTE', NULL, '(85) 9 8871-3838', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'RITA CELIA MONTENEGRO CAVALCANTE' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'PETRÔNIO FIGUEIRÊDO', '386.694.393-87', '(85) 9 9985-5777', 'petronio.70@hotmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '386.694.393-87');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'PATRICIA PINHEIRO GURGEL DE ALBUQUERQUE', '321.058.513-04', '(86) 9 9958-9429', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '321.058.513-04');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'SILVANA MARIA ALVES CAVALCANTE', '155.583.983-53', '(85) 9 9790-3731', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '155.583.983-53');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ANDRÉ LUIZ ALVES DE SOUSA', '506.064.503-78', '(85) 9 8130-2422', 'andrelual@hotmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '506.064.503-78');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'DANIELA SAMPAIO  CORTEZ MOTA', '758.774.063-53', '(85) 9 9701-0810', 'daniscortez@hotmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '758.774.063-53');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'RODRIGO CARVALHO', '623.752.293-04', '(85) 9 9711-2591', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '623.752.293-04');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARIA YOLANDA DE SOUZA BEZERRA', '174.174.573-04', '(85) 9 8512-6617', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '174.174.573-04');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ELMA LOPES', NULL, '(85) 9 8714-3738', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'ELMA LOPES' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ISOLDA VASCONCELOS DE QUEIROZ', '174.504.623-20', '(85) 9 8787-1025', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '174.504.623-20');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'CELIENE DA SILVA DANIEL', NULL, '(85) 9 9815-5357', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'CELIENE DA SILVA DANIEL' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'EDILSON BARBOSA AGUIAR', '769.923.814-15', '(85) 9 9731-7185', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '769.923.814-15');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'VALÉRIA NOGUEIRA DE OLIVEIRA FERREIRA GOMES', '026.630.963-18', '(85) 9 9717-7775', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '026.630.963-18');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'FRANCISCA OLIVEIRA PEDROSA', '603.215.703-24', '(85) 9 8550-8372', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '603.215.703-24');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARTA MENDONÇA LOPES', '621.992.853-91', '(85) 9 8686-8625', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '621.992.853-91');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'EMANUEL MEIRELES VIEIRA', '658.317.303-44', '(85) 9 8930-7876', 'emanuel.meireles@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '658.317.303-44');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'JOANA D`ÁVILA DE SOUSA CAMINHA MUNIZ', '546.903.583-20', '(85) 9 9231-0988', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '546.903.583-20');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'CARLOS EDUARDO NOGUEIRA', '129.835.937-62', '(85) 9 8547-1918', 'ceduardonogueirasantos@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '129.835.937-62');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ISABEL CRISTINA LUCK COELHO DE HOLANDA', '283.808.353-87', '(85) 9 8600-2812', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '283.808.353-87');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'JOAO AGLAYLSON FIGUEREIRO BARBOSA', '464.028.293-15', '(85) 9 8761-2120', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '464.028.293-15');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'RAIMUNDO COSTA DE OLIVEIRA', NULL, '(84) 9 9860-3773', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'RAIMUNDO COSTA DE OLIVEIRA' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARCELO DUTRA BARROS', '663.401.873-15', '(85) 9 8886-9787', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '663.401.873-15');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ANTONIA SAMMYA TRAJANO BEZERRA', '641.389.413-04', '(85) 9 9934-7371', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '641.389.413-04');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARCELO ROCHA AGUIAR', '079.931.346-76', '(31) 9 9143-7645', 'aguiarmarcelo@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '079.931.346-76');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ALVARO AUGUSTO WEYNE LEITE DE ARAUJO MUNIZ', NULL, '(85) 9 9167-6140', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'ALVARO AUGUSTO WEYNE LEITE DE ARAUJO MUNIZ' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ELIEUDO CORDEIRO DO NASCIMENTO', '079.714.233-90', '(85) 9 8134-8103', 'cordeiroelieudo67@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '079.714.233-90');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ROBERTO SOARES BULCÃO COUTINHO', '461.512.143-15', '(85) 9 9981-3569', 'rsbcface0352@hotmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '461.512.143-15');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'IGOR CARVALHO FIGUEIRA', '069.283.413-35', '(85) 9 8613-5050', 'igor123cf@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '069.283.413-35');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'RICARDO MENDES SOARES', '645.238.883-53', '(85) 9 8613-0228', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '645.238.883-53');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARIA DO SOCORRO CASTRO SILVA', '294.109.163-72', '(85) 9 9992-2042', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '294.109.163-72');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'LUIS FARIAS DA SILVA', '163.308.623-20', '(85) 9 9170-2705', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '163.308.623-20');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ELISABETE PINHEIRO DA SILVA', '315.123.053-91', '(85) 9 9937-6002', 'elisabetelavras@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '315.123.053-91');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARIA MIRTE VIEIRA LIMA', '319.763.793-34', '(85) 9 9822-3226', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '319.763.793-34');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ROMULO SABOYA RIBEIRO', '070.715.663-72', '(85) 9 9935-7649', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '070.715.663-72');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'WILSON ROBERTO JUNIOR', NULL, '(85) 9 9617-7237', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'WILSON ROBERTO JUNIOR' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARTA LEUDA LUCAS DE SOUSA', '389.430.503-72', '(85) 9 9245-9960', 'marta.lucas41@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '389.430.503-72');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'HESLEY ROCHA', '048.149.523-17', '(85) 9 9858-5226', 'hesley25@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '048.149.523-17');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ELIANE LIMA', NULL, '(68) 9 9227-2356', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'ELIANE LIMA' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'FRANCIELIO SABOIA PONTES', '043.289.973-19', '(85) 9 9827-3028', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '043.289.973-19');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARCONE DOS SANTOS PEREIRA', '423.082.403-34', '(85) 9 9186-1570', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '423.082.403-34');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARIA ANTONIO MILEA MANDARDO', '140.231.052-87', '(85) 9 9200-9696', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '140.231.052-87');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'PRISCILA LIMA DE CASTRO', '955.692.603-82', '(85) 9 8699-2302', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '955.692.603-82');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARCIO MARLEY RODRIGUES GOUVEIA', '808.225.173-53', '(85) 9 8803-7570', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '808.225.173-53');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'TERESA MARIA MORA', NULL, '(85) 9 8663-2241', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'TERESA MARIA MORA' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'LUIZ GONZAGA NUNES DA TRINDADE JUNIOR', '150.384.913-91', '(85) 9 9929-8898', 'luiztrindadejr@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '150.384.913-91');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARIA UBERLANDIA AGOSTINHO FIGUEIREDO', '369.206.063-72', '(85) 9 8770-5496', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '369.206.063-72');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARIA DE JESUS ALBUQUERQUE DE PAIVA', '104.774.623-91', '(85) 9 9121-0240', 'majesuspaiva@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '104.774.623-91');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'INGRIND PEIXOTO BESSA', NULL, '(85) 9 9642-0689', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'INGRIND PEIXOTO BESSA' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ANA CECILIA VIEIRA', '067.189.763-26', '(85) 9 8924-5734', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '067.189.763-26');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'GEMARIA CRISTINA DE SOUZA FELIX', '018.096.773-86', '(85) 9 8212-6863', 'elieser810@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '018.096.773-86');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'JOSE BARROSO PIMENTEL', '065.325.353-20', '(85) 9 8864-1688', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '065.325.353-20');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'FRANCISCA JANIELE MORENO LOPES', '046.895.823-19', '(85) 9 9712-8006', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '046.895.823-19');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'RAMONN GONÇALVES SILVA', '604.024.943-93', '(85) 9 9624-4502', 'ramonn_gmc@hotmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '604.024.943-93');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'CLAUDIANE BARROS VASCONCELOS', '555.530.363-72', '(85) 9 8895-0181', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '555.530.363-72');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARIA RIBEIRO BENTO DA SILVA', '764.976.073-15', '(88) 9 9785-3734', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '764.976.073-15');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ARTHUR DOUGLAS DE MORAIS PINHO', '062.477.323-09', '(85) 9 8101-0055', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '062.477.323-09');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'LIDICE MARJORIE MONTEIRO DE SOUZA BRITO', '008.358.283-52', '(85) 9 8749-3595', 'lidicemarjorie@hotmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '008.358.283-52');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ANTONIETA DR. FELIPE', NULL, '(85) 9 8848-2993', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'ANTONIETA DR. FELIPE' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARIA SOCORRO OLIVEIRA SANTANA', '245.642.493-04', '(85) 9 9739-8343', 'socorrooliveira2525@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '245.642.493-04');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'RICARDO ARAUJO FERREIRA', '231.976.333-34', '(85) 9 8944-2530', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '231.976.333-34');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'JOSYANNE OSORIO MORAIS DE SOUZA', NULL, '(85) 9 8802-5434', 'josyanneosorio@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'JOSYANNE OSORIO MORAIS DE SOUZA' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ANA LUCIA LIMA PEREIRA', '247.515.293-15', '(85) 9 8842-0707', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '247.515.293-15');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'RONALD FREITAS SPINOLA', '735.463.133-72', '(85) 9 9111-7889', 'ronaldppcalado@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '735.463.133-72');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'DEBORA MARIA MAGALHAES ALMEIDA', '623.720.093-20', '(85) 9 9844-1575', 'deborammag1@hotmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '623.720.093-20');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ISABELE TECIA SILVA ASSUNÇÃO', '072.023.253-81', '(49) 1 7820-0958', 'sapelhita@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '072.023.253-81');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'LINCOLN BARBOSA SANTOS', '755.988.173-49', '(85) 9 8833-0806', 'lincolnsantos04@hotmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '755.988.173-49');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'TEREZA CRISTINA DIOGENIS', NULL, '(85) 9 8815-8141', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'TEREZA CRISTINA DIOGENIS' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'TITO JOSE DA SILVA CARDOSO', '038.616.523-82', '(85) 9 8722-4440', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '038.616.523-82');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'LARISSE MOTA MARQUES', '013.605.293-22', '(85) 9 8199-3334', 'iarimotamarques@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '013.605.293-22');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'IZAURA MONTEIRO DA SILVA', '000.911.533-10', '(85) 9 9970-8603', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '000.911.533-10');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ELIELZA GONÇALVES PEREIRA', NULL, '(85) 9 8237-5115', 'goncalveselielza@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'ELIELZA GONÇALVES PEREIRA' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'FRANCISCO ALISSOM DA SILVA BARROSO', '621.878.973-03', '(99) 9 9225-3798', 'alissombarroso1991@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '621.878.973-03');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARIA DAS GRAÇAS FREITAS MENDES', '220.776.343-91', '(85) 9 9979-8723', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '220.776.343-91');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'JOANA ANGELICA CAVALCANTE CAMURÇA BERNHARTD', NULL, '(85) 9 8876-3427', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'JOANA ANGELICA CAVALCANTE CAMURÇA BERNHARTD' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'LIVIA SIQUEIRA VIEIRA DE SOUSA', '982.711.563-49', '(85) 9 9811-5102', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '982.711.563-49');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MINGUEL DE CASTRO NETO', '211.737.293-72', '(85) 9 9985-0103', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '211.737.293-72');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'EMANUEL BRUNO CARIOCA SILVA', '054.960.933-41', '(85) 9 9432-7732', 'bruno06carioca@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '054.960.933-41');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'FRANCISCO NETO CAVALCANTE', '055.405.963-07', '(85) 9 9871-0439', 'gironeto@live.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '055.405.963-07');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARIA GISELLE MAIA', NULL, '(88) 9 9657-3038', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'MARIA GISELLE MAIA' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'CATHARINA MENEZES', NULL, '(85) 9 9249-2222', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'CATHARINA MENEZES' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'RAFAEL CROCE', NULL, '(11) 9 1081-0098', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'RAFAEL CROCE' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ANDREA LYRA GUERRA JOSINO', '465.941.243-15', '(85) 9 8710-0044', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '465.941.243-15');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'FRANCISCO MARTINS JÚNIOR', NULL, '(85) 3245-1212', 'fcoavmjunior@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'FRANCISCO MARTINS JÚNIOR' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'LUAN SOUZA DE OLIVEIRA', '145.201.367-50', '(85) 9 8818-7068', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '145.201.367-50');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ADERBAL PINHEIRO BEZERRA', '267.446.863-72', '(85) 9 9766-5176', 'aderbalbezerra@hotmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '267.446.863-72');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARIA KELBIA DO EGITO DA ROCHA', '822.333.143-87', '(85) 9 9996-1505', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '822.333.143-87');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'CLARA FARIAS OTONI', NULL, '(85) 9 9905-2203', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'CLARA FARIAS OTONI' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'IVANA DOS SANTOS FONSECA', '807.044.093-72', '(85) 9 9961-8523', 'ivasfonseca@hotmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '807.044.093-72');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ALEX ARAUJO DE VASCONCELLOS', '617.047.683-49', '(85) 9 8167-7676', 'alex.vascocellos@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '617.047.683-49');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'WALDER DE SOUZA SOARES', NULL, '(85) 9 8746-5771', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'WALDER DE SOUZA SOARES' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'DALMARIO DE OLIVEIRA FILHO', '390.953.803-78', '(85) 9 8559-5797', 'dalfilho1969@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '390.953.803-78');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MATHEUS NOGUEIRA DOS SANTOS', NULL, '(85) 9 9654-6699', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'MATHEUS NOGUEIRA DOS SANTOS' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARIA SUSANETE DE OLIVEIRA ARAUJO', NULL, '(85) 9 9644-1603', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'MARIA SUSANETE DE OLIVEIRA ARAUJO' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'LAVINIA NEVES MEDEIROS', '065.479.593-25', '(85) 9 9652-8232', 'lavinianmed@outlook.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '065.479.593-25');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'RENATA DE SOUSA PARENTE', '024.019.653-86', '(85) 9 8867-7770', 'renataaparente@hotmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '024.019.653-86');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'NEWTON FONTENELE TEIXEIRA', NULL, '(85) 9 9987-4236', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'NEWTON FONTENELE TEIXEIRA' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'CAROLINE DE ALBUQUERQUE COELHO REBOUÇA', '868.510.203-00', '(85) 9 9603-0908', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '868.510.203-00');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARIA GUILHERMINA RENDA KA TILLIO', '009.946.824-76', '(85) 9 9961-8300', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '009.946.824-76');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'RITA MARIA GREENE', '117.757.423-34', '(85) 9 9808-3303', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '117.757.423-34');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'FRANCISCA LUCIA MOURA BARROZO', NULL, '(85) 9 8669-2474', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'FRANCISCA LUCIA MOURA BARROZO' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARIA EDUARDA LOPES FALCÃO', '617.115.033-98', '(85) 9 8830-9036', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '617.115.033-98');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'LEANDRO LIMA', '041.371.509-40', '(21) 9 7007-6377', 'leandrolima_lima@hotmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '041.371.509-40');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARGARIDA RENDA', NULL, '(85) 9 9961-8300', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'MARGARIDA RENDA' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ISADORA LIMA DO SANTOS', NULL, '(85) 9 8859-0890', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'ISADORA LIMA DO SANTOS' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ANTONIO KLEBER FREIRE BANDEIRA JUNIOR', '636.192.963-91', '(85) 9 9988-8819', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '636.192.963-91');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ALINE BECCO DA SILVA', '873.406.233-53', '(85) 9 9732-9587', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '873.406.233-53');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'RAIMUNDA DE SOUSA DOS SANTOS', '719.336.893-15', '(85) 9 9775-1165', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '719.336.893-15');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARCOS  FABIO MAIA', NULL, '(85) 9 9706-9938', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'MARCOS  FABIO MAIA' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ANTONIA GONÇALVES MOURA', '294.816.353-68', '(88) 9 9606-3653', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '294.816.353-68');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'FABIANA PIMENTEL CORREIA', '060.604.993-25', '(85) 9 9617-6704', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '060.604.993-25');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'PEDRO LUCAS FAHD DE OL.IVEIRA', '027.260.133-09', '(85) 9 9674-2974', 'pedrofahd@hotmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '027.260.133-09');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'LUCY MARY CONRADO DE CARVALHO MAIA', '464.251.953-04', '(85) 9 8900-3101', 'eulaliamaia@yahoo.com.br', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '464.251.953-04');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'SILVIA RAQUEL DE ARAUJO RODRIGUES CID', '613.324.373-20', '(85) 9 8596-6132', 'iradescid1@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '613.324.373-20');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ISABEL ROCHA FILGUEIRAS', NULL, '(11) 9 8901-5291', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'ISABEL ROCHA FILGUEIRAS' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'WALKIRIA BATISTA DA SILVA LIMA', '500.349.013-53', '(85) 9 8714-6847', 'walkirialima09@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '500.349.013-53');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARILENE DE AQUINO MESQUISTA', '210.343.113-87', '(85) 9 9613-4843', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '210.343.113-87');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'BEATRIZ VASCONCELOS', NULL, '(85) 9 9261-6274', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'BEATRIZ VASCONCELOS' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ANGELA SIQUEIRA FURTADO MARTINS', '950.360.243-20', '(85) 9 9999-0012', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '950.360.243-20');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'DANIEL CARVALHO DE FREITAS', NULL, '(85) 9 9801-1424', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'DANIEL CARVALHO DE FREITAS' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ALCIDES MATIAS', NULL, '(85) 9 9706-9938', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'ALCIDES MATIAS' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'TIEMI LIMA OKAMOTO', '050.814.134-61', '(85) 9 8155-7779', 'tiemi-okamoto@hotmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '050.814.134-61');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'LIRA RAMOS DE OLIVEIRA', '073.449.023-20', '(85) 9 9616-7703', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '073.449.023-20');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARIA ODILA GOMES BESSA', '111.225.953-87', '(85) 9 8685-2194', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '111.225.953-87');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ARMINDA PARTOR DE LIMA', '541.314.213-72', '(85) 9 9762-7530', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '541.314.213-72');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'JUREMA RODRIGUES', '210.030.762-20', '(96) 9 9141-7206', 'jurodrigues149@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '210.030.762-20');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'PAULA FREIRE ROMA', '398.340.218-60', '(85) 9 8445-9309', 'paula_roma8d@hotmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '398.340.218-60');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'FRANCISCO DE ALMEIDA TORRES NETO', '015.858.593-38', '(85) 9 9778-9041', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '015.858.593-38');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'PEDRO AMARO DE ARAGÃO', '103.652.893-61', '(85) 9 9140-2258', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '103.652.893-61');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARCOS ANTONIO HOLANDA MAGALHAES', '054.117.183-68', '(85) 9 8696-8688', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '054.117.183-68');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'TALES AMARO BEZERRA NETO', '046.737.503-81', '(85) 9 9733-8181', 'talesbezerraneto@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '046.737.503-81');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARIA ELIANE SANTIAGO FREIRE', '136.596.423-04', '(85) 9 9983-0076', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '136.596.423-04');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'LUANNA CAVALCANTE', '603.704.943-26', '(85) 9 8804-4705', 'luannacavalcante489@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '603.704.943-26');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'DIEGO ROMÃO MARTINS', '011.517.803-16', '(85) 9 8865-2688', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '011.517.803-16');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MICHELLE DOS SANTOS SOBRAL', '739.682.693-49', '(85) 9 9925-7490', 'michelle.sobral2501@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '739.682.693-49');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'FAGNER FREIRE  NOGUEIRA', '018.513.943-46', '(85) 9 9773-3028', 'fagnerfreire@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '018.513.943-46');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARIA VALDILENE SILVA SAMPAIO', '978.918.863-34', '(85) 9 9915-1939', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '978.918.863-34');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ANISIA GONZAGA DE OLIVEIRA', '107.489.623-87', '(85) 9 9673-1878', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '107.489.623-87');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARIA DAS DORES LIMA DA SILVA', '263.883.243-04', '(85) 9 9149-4519', 'mdasdoressilvalima@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '263.883.243-04');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'DENISE MOREIRA DE AGUIAR', '422.362.743-00', '(85) 9 9926-4646', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '422.362.743-00');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'FRANCISCO RONALD DE SOUSA COSTA', '729.628.443-91', '(85) 9 8156-4747', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '729.628.443-91');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARIA DE FATIMA MENDES MATIAS', '111.623.093-34', '(85) 9 8711-4187', 'fm220758@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '111.623.093-34');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'DENISE LESSA MATIAS', '901.198.863-91', '(85) 9 8101-8031', 'denise.lessa.matias@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '901.198.863-91');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARIA AUXILIADORA SILVA ABRAO', '081.167.173-91', '(85) 9 8616-7967', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '081.167.173-91');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'REJANE NUNES', '634.119.033-68', '(85) 9 9239-1020', 'rejanenunes@hotmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '634.119.033-68');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'CARMOZITA MENDONÇA DE MATOS SALES', '260.393.463-53', '(85) 9 9813-0574', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '260.393.463-53');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MIRIAN PINHEIRO RODRIGUES', '389.016.413-72', '(88) 9 9601-6727', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '389.016.413-72');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARIA ARLINDA CARVALHO CARNEIRO', '300.067.243-53', '(85) 9 8976-4818', 'matcellesfcarneiro24@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '300.067.243-53');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'RAIMUNDO CÉSAR MENDONÇA DE SANTIAGO', '073.579.823-00', '(85) 9 9983-9450', 'cesar@logosfor.com.br', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '073.579.823-00');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ANTONIO BEZERRA DE MORAIS', '037.717.683-49', '(85) 9 8607-2450', 'antoniobmorais116@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '037.717.683-49');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'SILVIA CRISTINA NUNES BENTE', '189.494.362-72', '(85) 9 8678-3882', 'silvianbentes@yahoo.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '189.494.362-72');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'PAULO CESAR SILVA SANTIAGO', '854.451.854-00', '(85) 9 2002-7033', 'santiago.paulo13@hotmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '854.451.854-00');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARIA MAZZARELLO MACEDO ARRAIS', '800.976.693-34', '(85) 9 9664-6838', 'mazzarelloarrais@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '800.976.693-34');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'THIAGO EVANGELISTA VASCONCELOS', '993.058.953-87', '(85) 9 8832-2498', 'thievas@yahoo.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '993.058.953-87');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'TAMIRES DIOGO DA COSTA', '052.038.123-81', '(85) 9 8865-5915', 'tamydiogo92@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '052.038.123-81');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'RENE  MARINHO DE ASSIS', '043.307.033-19', '(85) 9 8746-4235', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '043.307.033-19');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'JOÃO  LEITE JUNIOR', '648.074.283-49', '(85) 9 9280-4124', 'joaojrleite@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '648.074.283-49');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ANA CLARA SALVIATO CAPASSI', '227.510.428-30', '(11) 9 1318-0288', 'acs.capassi@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '227.510.428-30');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARIA LIDIANA RUBENS MAIA BARROS', '615.958.533-91', '(85) 9 8899-9769', 'lidianabarros@hotmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '615.958.533-91');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'VERA LUCIA SALES VIEIRA', '059.612.113-04', '(85) 9 9756-7556', 'verasbiras@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '059.612.113-04');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'YANA ISABELLE FERREIRA', '060.405.293-69', '(88) 9 9496-3529', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '060.405.293-69');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'LEANDRO GUIMARAES BIZERRIL', '706.541.403-59', '(85) 9 8728-6882', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '706.541.403-59');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARIA REGINA FREIRE DA SILVA', '163.811.303-34', '(85) 9 8857-1723', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '163.811.303-34');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARIA DEIGIANE MARANHÃO', NULL, '(85) 9 8848-5639', 'yannemaranhao12@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'MARIA DEIGIANE MARANHÃO' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MANOEL CLAUDENOR DA SILVA RAFAEL', NULL, '(85) 9 8899-9871', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'MANOEL CLAUDENOR DA SILVA RAFAEL' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'PAULO ANTONIO FERNANDES FREITAS', '074.187.443-15', '(85) 9 8723-3734', 'paulofernandesce@hotmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '074.187.443-15');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ELANIZE BATALHA DA SILVA', '320.260.992-00', '(85) 9 9749-5718', 'elanize_batalha@hotmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '320.260.992-00');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARIA MARLETE FEITOSA', '213.689.103-00', '(85) 9 8743-3950', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '213.689.103-00');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'SUELY VALERIA MENEZES DE OLIVEIRA', NULL, '(85) 9 9181-6326', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'SUELY VALERIA MENEZES DE OLIVEIRA' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'BIEVENIDO SANDRO ANDRADE FIUZA', NULL, '(85) 9 8894-1721', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'BIEVENIDO SANDRO ANDRADE FIUZA' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'FRANCISCA GONÇALVES TEIXEIRA COSTA', NULL, '(88) 9 9847-3883', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'FRANCISCA GONÇALVES TEIXEIRA COSTA' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'FRANCISCO MANACES BRAGA DE MESQUITA', '902.214.518-20', '(85) 9 9857-2652', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '902.214.518-20');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'LUCIANA MARIA FERREIRA PONTE', '314.095.553-72', '(85) 9 8892-6172', 'lucianapontes@yahoo.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '314.095.553-72');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARIA ALVES BRAGA SOARES', '174.036.773-15', '(85) 9 9954-0433', 'mariaalvesbragasoares@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '174.036.773-15');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'JOSE OSMILDO SANTANA', '221.142.383-34', '(85) 9 9953-7362', 'santanaaila2012@hotmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '221.142.383-34');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'CLEANE PINHEIRO DE ARAUJO', '456.262.003-04', '(85) 9 8746-9682', 'pcleanea@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '456.262.003-04');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'FRANCISCO MOREIRA RIBEIRO', NULL, '(85) 9 8670-2670', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'FRANCISCO MOREIRA RIBEIRO' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ISADORA CASTELO BRANCO SOLON', '062.922.503-69', '(85) 9 9712-1518', 'casteloisador-adv@outlook.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '062.922.503-69');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'VICENTE DE PAIVA', '618.023.873-15', '(85) 9 9907-7778', 'diretoria@hotelmeridicional.com.br', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '618.023.873-15');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'NAIDE AUGUSTO DE SOUZA', '020.914.523-43', '(85) 9 9903-8163', 'naidesouza1010@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '020.914.523-43');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ANDERSON AMORIM PARENTE', NULL, '(85) 9 8868-1689', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'ANDERSON AMORIM PARENTE' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'FRANCISCO WASHINGTON BORGES DE OLIVEIRA', '006.133.563-06', '(85) 9 8632-1234', 'wbobrasil@hotmai.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '006.133.563-06');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARIA CLARA LIMA GOMES', NULL, '(85) 9 9865-0133', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'MARIA CLARA LIMA GOMES' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'SELENE REGINA MAZZA', '321.850.903-30', '(85) 9 9921-0520', 'selene_mazza@yahoo.com.br', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '321.850.903-30');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ANTONIO CICERO VICENTE GOMES PIMENTEL', '065.433.933-35', '(85) 9 9988-9199', 'acvgomespimentel@hotmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '065.433.933-35');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ANDERSON PAULINO DIAS', '057.972.243-05', '(85) 9 8883-0933', 'andersonpaulinodias@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '057.972.243-05');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'JHON WILLIAM WUCHNER', '602.267.793-94', '(85) 9 9902-9940', 'jwuchner@hotmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '602.267.793-94');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ANA MARIA PARENTE BESSA', '313.691.972-68', '(85) 9 9835-1181', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '313.691.972-68');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'HELEINY LETTIERE DO NASCIMENTO LIMA', '024.588.244-80', '(85) 9 9900-0607', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '024.588.244-80');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'EUDENIA EDUARDO DE SOUSA', '604.248.803-18', '(88) 9 8213-9121', 'eduardoeudenia@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '604.248.803-18');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'FRANCISCO CLEBIO PINTO DO NASCIMENTO', NULL, '(85) 9 9605-2583', 'clebiopinto44@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'FRANCISCO CLEBIO PINTO DO NASCIMENTO' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'KYLVIA THATYANA TORRES MOREIRA', '738.396.473-04', '(85) 9 9977-7778', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '738.396.473-04');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'EDUARDO SCARPELLINI', '325.879.468-59', '(11) 9 6121-9001', 'scarpellini@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '325.879.468-59');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ANA PAULA FERREIRA ARRAIS', '915.943.243-87', '(85) 9 8711-3694', 'anapaulaarrais@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '915.943.243-87');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'FRANCISCO RENAN GOMES DA SILVA', '609.447.043-52', '(85) 9 9993-4385', 'gomesrenan19@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '609.447.043-52');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'FERNANDA KELLY COSTA SANTIAGO', '022.104.573-27', '(85) 9 8559-9084', 'kellysantiago61@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '022.104.573-27');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'CARMEN BEZERRA SANTOS', '302.519.233-04', '(85) 9 8885-9501', 'carmen_bezerra@hotmai.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '302.519.233-04');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'FRANCISCO MARCIO FARIAS DA COSTA', '007.186.893-30', '(41) 9 8877-0703', 'fmarciofarias@hotmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '007.186.893-30');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'F ROBERIO FERREIRA COSTA', NULL, '(85) 9 8732-3244', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'F ROBERIO FERREIRA COSTA' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'SONIA MARIA CARNEIRO DA CRUZ', '227.115.892-34', '(88) 9 9639-3755', 'prof.soniacruz@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '227.115.892-34');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'GIOVANNI LEITE MAMEDE', '768.494.303-00', '(85) 9 8781-5617', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '768.494.303-00');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'GISELE PEREIRA DA SILVA COSTA', '056.423.093-66', '(88) 9 9705-9228', 'giselipereira80@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '056.423.093-66');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARIA ROSIANE DE SOUZA', NULL, '(85) 9 8963-5239', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'MARIA ROSIANE DE SOUZA' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARIA MOREIRA MARQUES', NULL, '(88) 9 9732-3251', 'mariamoreiramarques@hotmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'MARIA MOREIRA MARQUES' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARIA DE FÁTIMA NASCIMENTO DE LIMA', NULL, '(85) 9 9196-9708', 'mf1161042@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'MARIA DE FÁTIMA NASCIMENTO DE LIMA' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'SOPHIA DIAS', NULL, '(88) 9 9729-5882', 'sophiacosta1976@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'SOPHIA DIAS' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'JOÃO GUILHERME CAVALCANTE CAMPELO MACEDO', NULL, '(85) 9 8663-9193', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'JOÃO GUILHERME CAVALCANTE CAMPELO MACEDO' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'SAMUEL MELO MONTENEGRO DA ROCHA MOTTA', '025.182.513-24', '(85) 9 9772-9000', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '025.182.513-24');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARIA NAZIRA MAIA LEITE', NULL, '(85) 9 8131-3059', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'MARIA NAZIRA MAIA LEITE' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'EVILASIO ALMEIDA RAMOS FILHO', '853.401.203-25', '(85) 9 9921-3431', 'evilasio_filho@yahoo.com.br', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '853.401.203-25');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ELIANE FURTADO DA SILVA', '740.422.973-15', '(85) 9 9623-4034', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '740.422.973-15');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ODALIA MARIA DE SOUSA ROCHA', NULL, '(85) 9 9195-9987', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'ODALIA MARIA DE SOUSA ROCHA' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'BRUNA FERREIRA DE ALENCAR ARARIPE', '078.486.673-24', '(85) 9 9613-8000', 'brunafalencara@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '078.486.673-24');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'RAIMUNDO  PINTO FILHO', '235.860.443-72', '(85) 9 9984-3648', 'raiumndo.pinto@hotmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '235.860.443-72');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ROSIMEIRE FELICIO NOGUEIRA', '144.230.653-04', '(85) 9 9984-8542', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '144.230.653-04');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'LUIZ GONZAGA BARBOZA DOS SANTOS', NULL, '(85) 9 9775-1165', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'LUIZ GONZAGA BARBOZA DOS SANTOS' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'NILRA MARIA BASTOS MAIA LIMA', '618.899.543-49', '(85) 9 9965-0008', 'nilmaia@hotmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '618.899.543-49');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARIA ADRIANA HILÁRIO FREITAS', '734.218.553-15', '(85) 9 8699-1049', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '734.218.553-15');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ALDAIR PEREIRA DA SILVA', '040.075.133-09', '(85) 9 8900-2419', 'aldairpereira90@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '040.075.133-09');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ROSIANE SALDANHA DE AZEVEDO', '370.078.743-04', '(85) 9 8885-5047', 'rosiane1762@hotmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '370.078.743-04');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ALLAN ALBUQUERQUE', '071.913.363-74', '(85) 9 9754-4230', 'allan_clt@hotmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '071.913.363-74');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARIA MIRTES PONTES VIEIRA', NULL, '(85) 9 9643-4915', 'patricia.apv@hotmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'MARIA MIRTES PONTES VIEIRA' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'JOSÉ OLAVO DE SOUSA', '141.248.073-68', '(85) 9 9604-4356', 'zeolavo2304@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '141.248.073-68');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'TARCÍSIO RIBEIRO VIEIRA JUNIOR', NULL, '(85) 9 8866-4502', 'trvjunior@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'TARCÍSIO RIBEIRO VIEIRA JUNIOR' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'DAVID MAIA COSTA', NULL, '(85) 9 8161-7171', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'DAVID MAIA COSTA' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'JOANA KEYLA DA SILVA ALVES', '024.855.153-10', '(85) 9 9749-7970', 'joanakeilaalves@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '024.855.153-10');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'LUCAS GUILHERME BELEZA', '051.545.923-28', '(85) 9 9610-6454', 'lucasgbeleza@outlook.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '051.545.923-28');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ROGÉRIO PALÁCIO DE ARAÚJO', '426.832.383-04', '(85) 9 9634-6747', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '426.832.383-04');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MACIELA BATISTA DO NASCIMENTO', '930.949.903-63', '(85) 9 9247-9545', 'macielabn@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '930.949.903-63');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'BRENDA KELLY OLIVEIRA DOS ANJOS', '607.850.503-37', '(85) 9 9773-3032', 'brendadosanjos.arq@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '607.850.503-37');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'LUIZ CARLOS PINHEIRO MAIA', '464.254.543-34', '(85) 9 8615-8584', 'vetcampo@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '464.254.543-34');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'NILDEMBERG FREITAS FERREIRA', '041.628.423-02', '(85) 9 8519-4906', 'nildembergfreitas@hotmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '041.628.423-02');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'LUANA GOMES DE ALCÂNTARA', '088.838.363-08', '(85) 9 9994-5869', 'lulualc2011@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '088.838.363-08');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'EVELLINE CAVALCANTE', '017.791.573-04', '(85) 9 8806-1529', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '017.791.573-04');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'CLEYDSON DA SILVA BARATA', NULL, '(85) 9 8569-3451', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'CLEYDSON DA SILVA BARATA' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'JUAN CARLOS MONTEIRO CARDENAS', NULL, '(88) 9 9833-5328', 'milviaesther@yahoo.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'JUAN CARLOS MONTEIRO CARDENAS' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'TALES SETÚBAL PIRES', '065.902.303-23', '(85) 9 8124-2802', 'mspfisica2@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '065.902.303-23');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'JOSE MENDES LOBO', '548.607.418-20', '(85) 9 9637-2226', 'jml_1950@hotmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '548.607.418-20');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'LAIANE CARVALHO MONTEIRO', '037.714.953-50', '(85) 9 9641-7238', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '037.714.953-50');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ANTONIO LEUDIVAN DE OLIVEIRA LIMA', '410.452.463-87', '(88) 9 9945-1233', 'leudivanlima@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '410.452.463-87');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'CRISTIANA SALES SILVA DE OLIVEIRA', NULL, '(85) 9 8737-7441', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'CRISTIANA SALES SILVA DE OLIVEIRA' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'VANDA LÚCIA MACÊDO BELÉM DE PINHO', '355.490.333-72', '(85) 9 9994-1968', 'vandapinho@live.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '355.490.333-72');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'IGOR SILVA DE OLIVEIRA', '073.471.613-39', '(85) 9 9179-9637', 'igor@fip.eng.br', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '073.471.613-39');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'JOSE ANTONIO DO NASCIMENTO', '448.525.764-91', '(85) 9 9801-8944', 'd14mil48@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '448.525.764-91');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARIA HILARIANA SAMPAIO', '360.139.003-53', '(85) 9 9606-2039', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '360.139.003-53');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARIA DE LOURDES SOUZA LIMA', NULL, '(85) 9 9831-8394', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'MARIA DE LOURDES SOUZA LIMA' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'PHABIA VALESKA VALE ALVES BATALHA', '041.863.003-80', '(85) 9 9164-6942', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '041.863.003-80');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ALAN ÍCARO ALVES ARAÚJO', '622.890.923-12', '(85) 9 8422-0746', 'alanicaroalvesaraujo@gmai.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '622.890.923-12');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ANDRÉ AGUIAR', NULL, '(85) 9 8897-3059', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'ANDRÉ AGUIAR' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'LEONOR ROSENO DA SILVA', NULL, '(85) 9 8856-4672', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'LEONOR ROSENO DA SILVA' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'SUELY MONTEIRO BRASIL', '102.187.263-68', '(85) 9 9937-8660', 'suelymbrasil@hotmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '102.187.263-68');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'EMANUELLY AMORIM DE SOUSA', '067.271.653-43', '(86) 9 9866-0578', 'contato.emanuellyamorim@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '067.271.653-43');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ANA LUISA MENDONÇA DE CARVALHO', '611.556.213-95', '(85) 9 9601-6593', 'alcarvalhoarq@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '611.556.213-95');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ROSANA EMILLE MARQUES MAIA', '070.196.763-32', '(85) 9 9676-1145', 'emille.marques.maia@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '070.196.763-32');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ROMULO BARBOSA', '390.477.503-06', '(85) 9 8716-8868', 'romulo990@hotmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '390.477.503-06');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARILANE BATISTA CORREIA', '289.632.533-68', '(85) 9 9973-1702', 'marybcorreia@hotmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '289.632.533-68');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'FRANCISCO NAILSON DA ROCHA JUNIOR', '066.253.833-17', '(85) 9 8910-7583', 'nailson8835@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '066.253.833-17');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARIA ROSELI GOMES DE ABREU', '367.419.813-49', '(85) 9 9199-2931', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '367.419.813-49');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARIA CLOTILDE DE ARAÚJO ROCHA', '174.340.173-68', '(69) 9 8485-8035', 'mcar3796@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '174.340.173-68');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'YURI PEREIRA COELHO', '051.611.283-05', '(85) 9 9249-6212', 'yurijamall@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '051.611.283-05');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'THIAGO VICTOR XAVIER GONÇALVES', '057.562.153-28', '(85) 9 9953-5867', 'xavierthiago91@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '057.562.153-28');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'RAIMUNDA SOUSA FERREIRA', '139.251.643-91', '(85) 9 8961-9158', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '139.251.643-91');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'LUCAS BESERRA AIRES ROSA', '054.121.033-59', '(85) 9 9688-1104', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '054.121.033-59');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'RUTE PINHEIRO SOUSA', '134.528.513-20', '(85) 9 9635-6984', 'morganapinheironutri@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '134.528.513-20');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'EFLEM GONÇALVES NOGUEIRA', '384.138.253-34', '(85) 9 8823-7116', 'eflem520@hotmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '384.138.253-34');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'PEDRO IGOR  BEZERRA DE MORAIS', '628.821.473-68', '(85) 9 8146-0277', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '628.821.473-68');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARIA ISABEL ESTEVES MASCARENHAS PEREIRA', '051.043.123-21', '(85) 9 9788-5374', 'isabelmasc16@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '051.043.123-21');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'CLAUDIONIR DOS SANTOS', '534.408.115-49', '(85) 9 8625-0757', 'claudionir.nitomalhas@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '534.408.115-49');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARIA GORETE ROCHA THE MOTA', '367.466.143-87', '(85) 9 9991-9799', 'mararocha21@hotmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '367.466.143-87');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'SARA ALVES QUEIROZ', '127.000.913-37', '(85) 9 9203-1694', 'marianealves89@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '127.000.913-37');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'JOÃO MARCELO OLIVEIRA LEITÃO', '027.380.523-12', '(85) 9 9984-0014', 'joaomarceloleitao@hotmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '027.380.523-12');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'CELESTE DE ALMEIDA SOUZA', '211.237.483-49', '(85) 9 9901-6612', 'celestealmeida@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '211.237.483-49');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'NYRLANE GARCIA RABELO PINTO', '682.009.783-20', '(85) 9 9609-5213', 'nyrlanegrp@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '682.009.783-20');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARIA MOREIRA MENDONÇA VIANA', '109.808.733-04', '(88) 9 9967-1590', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '109.808.733-04');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'LIGIA PIRES CARVALHO MONTEIRO', NULL, '(85) 9 9641-7238', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'LIGIA PIRES CARVALHO MONTEIRO' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'VERA DE ABREU PEREIRA ARAUJO', '036.568.103-20', '(85) 9 9986-1048', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '036.568.103-20');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'DAMIANA MAIA DE SOUSA', '776.357.103-97', '(88) 9 9928-7991', 'postolubrificantemaia@hotmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '776.357.103-97');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'PATRICIA PESSOA LIMA', '615.764.333-15', '(85) 9 8115-7061', 'tisiapessoa1r@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '615.764.333-15');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'SAMUEL BARROS LOUREIRO', '779.623.893-20', '(88) 9 9204-4048', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '779.623.893-20');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'FRANCISCO IGOR DE OLIVEIRA BATISTA', '654.635.443-87', '(85) 9 9703-3354', 'igbakana@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '654.635.443-87');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'JOSÉ MARTINS CAMPELO', '779.445.503-00', '(85) 9 9784-5153', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '779.445.503-00');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARIA  DOC SOCORRO  DA SILVA LUNA', '144.423.533-87', '(85) 9 9926-8740', 'socorrolina@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '144.423.533-87');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'RAFAEL JOO YOUNG SON', '448.777.208-71', '(85) 9 8185-3594', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '448.777.208-71');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ANDRÉ DE AQUINO ALVARENGA', '615.908.353-87', '(85) 9 8898-8719', 'andrealvarenga76@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '615.908.353-87');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'LEOMAR ALVES DE QUEIROZ JUNIOR', NULL, '(85) 9 8147-2727', 'leomarjr21@hortmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'LEOMAR ALVES DE QUEIROZ JUNIOR' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MIRIAN PARENTE ARAUJO', '107.626.553-72', '(85) 9 9991-4441', 'lilyanamyr@yahoo.com.br', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '107.626.553-72');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'LILIA MARCIA SAMPAIO ANDRADE', '464.615.823-04', '(85) 9 9929-3361', 'liliamarcia0701@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '464.615.823-04');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARIA MARLENE RIBEIRO', '230.832.043-53', '(85) 9 9636-6567', 'adrianahellen0712@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '230.832.043-53');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ANA PAULA ALVES DA SILVA', '549.004.683-04', '(85) 9 9179-6275', 'apasnega@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '549.004.683-04');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ROGENA WEAVER NORONHA BRASIL', '057.586.103-72', '(85) 9 8839-5939', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '057.586.103-72');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'REINALDO SOUSA ALVES', '011.051.483-19', '(85) 9 8218-8374', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '011.051.483-19');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'PALLOMA MARIA DE A COIMBRA', NULL, '(85) 9 9157-3919', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'PALLOMA MARIA DE A COIMBRA' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MARIA DA CONCEIÇÃO ARAGÃO', '139.669.603-20', '(85) 9 8199-0144', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '139.669.603-20');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ZENAIDE SABINO DA SILVA', '266.209.793-00', '(85) 9 8854-3607', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '266.209.793-00');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ED WILSON CUSTÓDIO FRANCELINO', NULL, '(85) 9 9928-8990', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'ED WILSON CUSTÓDIO FRANCELINO' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'JOSE AMIRTON LOPES PIRES', '074.389.313-15', '(88) 9 9962-0930', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '074.389.313-15');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'RAIMUNDO POSSIDÔNIO  FILHO', '001.157.703-72', '(85) 9 9988-0231', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '001.157.703-72');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ERICA VIDAL DAMASCENO SAID', '589.720.133-15', '(85) 9 9217-2531', 'ericadamascenosaid@hotmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '589.720.133-15');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ANDRE LUIS NUNES AVELINO', '013.973.304-30', '(85) 9 9660-9021', 'luis_cdz@hotmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '013.973.304-30');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'MAYSA HELEN DE OLIVEIRA', '040.432.473-89', '(85) 9 9978-7070', 'maysahelen@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '040.432.473-89');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'DANIEL REBOUÇAS  OLIVEIRA', NULL, '(85) 9 8898-5555', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'DANIEL REBOUÇAS  OLIVEIRA' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'IÊDA VASCONCELOS DE SOUSA', '792.162.003-59', '(85) 9 8535-5354', 'dayanesales545@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '792.162.003-59');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'FRANCISCA NOBRE PONTES', '889.408.533-34', '(85) 9 9203-7749', 'edilsonfilho81@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '889.408.533-34');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'IEDA PEREIRA MORAIS', '093.384.383-68', '(85) 9 9695-3878', 'anapatricia.morais@hotmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '093.384.383-68');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'JUNIOR RODRIGUES DE SOUSA', NULL, '(85) 9 9138-1074', 'may_etna@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'JUNIOR RODRIGUES DE SOUSA' AND cpf IS NULL);
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'JOSELMA KATIANE', '776.006.223-00', '(85) 9 8818-9955', 'jkatianecap@gmail.com', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '776.006.223-00');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'FELIPE TEIXEIRA DE OLIVEIRA', '003.781.633-02', '(85) 9 9601-7902', 'felipe@jbhcontabilidade.com.br', true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE cpf = '003.781.633-02');
INSERT INTO pacientes (nome, cpf, telefone, email, ativo)
SELECT 'ANTONIO ALVES MORAIS', NULL, '(85) 9 9687-0722', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nome = 'ANTONIO ALVES MORAIS' AND cpf IS NULL);