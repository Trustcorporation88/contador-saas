/**
 * Gerador de Código de Barras para DAS (Documento de Arrecadação do Simples)
 * Formato: 00000.00000 00000.000000 00000.000000 0 00000000000000
 * Baseado na norma FEBRABAN para boletos de arrecadação
 */

/**
 * Gera um código de barras completo (44 dígitos)
 * Formato: BBBCCCCC VVVVVVVVVV DDDDDDDDDD X DDVVVVVVVVVV
 * B = Banco, C = Código Receita, V = Valor, D = Data Vencimento, X = Dígito Verificador
 */
export function generateBarCode(
  codigoReceita: string, // Ex: 0201 (Simples Nacional)
  numeroBoleto: string, // Ex: 202305000000001
  valor: string, // Ex: "1234.56"
  dataVencimento: Date, // Data do vencimento
): string {
  // Banco: 033 (Santander, usado para DAS em geral)
  const banco = '033';

  // Converter valor para centavos (sem casas decimais)
  const valorCentavos = String(
    Math.round(parseFloat(valor) * 100),
  ).padStart(10, '0');

  // Converter data de vencimento para formato DDMMYY
  const dia = String(dataVencimento.getDate()).padStart(2, '0');
  const mes = String(dataVencimento.getMonth() + 1).padStart(2, '0');
  const ano = String(dataVencimento.getFullYear()).slice(-2);
  const dataVencFormatada = `${dia}${mes}${ano}`;

  // Sequência numérica (baseada no número do boleto)
  const sequencia = numeroBoleto.slice(-8).padStart(8, '0');

  // Montar campo livre (primeira parte antes do dígito verificador)
  const campoLivre = `${codigoReceita}${numeroBoleto}${valorCentavos}${dataVencFormatada}`;

  // Calcular dígito verificador (módulo 11)
  const digitoVerificador = calcularDigitoVerificador(
    banco + campoLivre + sequencia,
  );

  // Montar código de barras completo (44 dígitos)
  const codigoBarras =
    banco + campoLivre.slice(0, 4) + valorCentavos + digitoVerificador +
    dataVencFormatada + sequencia;

  return codigoBarras;
}

/**
 * Gera a linha digitável (formato amigável para digitação manual)
 * Formato: BBBCC.CCCC V DDDDDDDDDD.DDDDDD V DDDDDDDDDD.DDDDDD V D DDVVVVVVVVVV
 */
export function generateLineNumber(codigoBarras: string): string {
  if (codigoBarras.length !== 44) {
    throw new Error('Código de barras deve ter 44 dígitos');
  }

  const banco = codigoBarras.slice(0, 3);
  const posicaoDigito = codigoBarras.slice(32, 33); // Dígito verificador
  const campo1 = codigoBarras.slice(4, 9);
  const campo2 = codigoBarras.slice(9, 20);
  const campo3 = codigoBarras.slice(20, 30);
  const campo4 = codigoBarras.slice(30, 32);
  const campo5 = codigoBarras.slice(33, 44);

  // Calcular dígitos verificadores para cada campo
  const dv1 = calcularDigitoVerificadorLinha(banco + campo1);
  const dv2 = calcularDigitoVerificadorLinha(campo2);
  const dv3 = calcularDigitoVerificadorLinha(campo3);

  // Montar linha digitável
  return (
    `${banco}${campo1}.${dv1} ${campo2}.${dv3} ${campo3}.${dv3} ` +
    `${posicaoDigito} ${campo4}${campo5}`
  );
}

/**
 * Calcula o dígito verificador (módulo 11)
 */
function calcularDigitoVerificador(sequencia: string): string {
  const multiplicadores = [2, 3, 4, 5, 6, 7, 8, 9];
  let soma = 0;
  let posicao = 0;

  // Processar da direita para esquerda
  for (let i = sequencia.length - 1; i >= 0; i--) {
    const digito = parseInt(sequencia[i], 10);
    const multiplicador = multiplicadores[posicao % multiplicadores.length];
    soma += digito * multiplicador;
    posicao++;
  }

  const resto = soma % 11;
  const dv = 11 - resto;

  return (dv === 0 || dv === 10 || dv === 11) ? '0' : String(dv);
}

/**
 * Calcula dígito verificador para campo da linha digitável
 */
function calcularDigitoVerificadorLinha(campo: string): string {
  const multiplicadores = [2, 3, 4, 5, 6, 7, 8, 9];
  let soma = 0;
  let posicao = 0;

  for (let i = campo.length - 1; i >= 0; i--) {
    const digito = parseInt(campo[i], 10);
    const multiplicador = multiplicadores[posicao % multiplicadores.length];
    soma += digito * multiplicador;
    posicao++;
  }

  const resto = soma % 11;
  const dv = 11 - resto;

  return (dv === 0 || dv === 10 || dv === 11) ? '0' : String(dv);
}

/**
 * Valida um código de barras DAS
 */
export function validarCodigoBarras(codigoBarras: string): boolean {
  if (codigoBarras.length !== 44) {
    return false;
  }

  if (!/^\d+$/.test(codigoBarras)) {
    return false;
  }

  // Extrair campos
  const banco = codigoBarras.slice(0, 3);
  const campo1 = codigoBarras.slice(4, 9);
  const campo2 = codigoBarras.slice(9, 20);
  const campo3 = codigoBarras.slice(20, 30);
  const digitoVerificador = codigoBarras.slice(32, 33);
  const campo5 = codigoBarras.slice(33, 44);

  // Recalcular dígito verificador
  const campoLivre = codigoBarras.slice(4, 32);
  const dvCalculado = calcularDigitoVerificador(
    banco + campoLivre + campo5,
  );

  return dvCalculado === digitoVerificador;
}

/**
 * Extrai informações do código de barras
 */
export interface InfoCodigoBarras {
  banco: string;
  codigoReceita: string;
  numeroBoleto: string;
  valor: number;
  dataVencimento: string;
  digitoVerificador: string;
}

export function extrairInfosCodigoBarras(
  codigoBarras: string,
): InfoCodigoBarras | null {
  if (!validarCodigoBarras(codigoBarras)) {
    return null;
  }

  const banco = codigoBarras.slice(0, 3);
  const codigoReceita = codigoBarras.slice(4, 8);
  const numeroBoleto = codigoBarras.slice(8, 16);
  const valorCentavos = parseInt(codigoBarras.slice(16, 26), 10);
  const valor = valorCentavos / 100;

  const dataStr = codigoBarras.slice(33, 39);
  const dia = dataStr.slice(0, 2);
  const mes = dataStr.slice(2, 4);
  const ano = `20${dataStr.slice(4, 6)}`;
  const dataVencimento = `${ano}-${mes}-${dia}`;

  const digitoVerificador = codigoBarras.slice(32, 33);

  return {
    banco,
    codigoReceita,
    numeroBoleto,
    valor,
    dataVencimento,
    digitoVerificador,
  };
}
