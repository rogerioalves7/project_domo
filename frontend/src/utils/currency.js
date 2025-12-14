/**
 * Formata um valor (number ou string) para o padrão BRL de visualização.
 * Ex: 1000.50 -> "1.000,50"
 */
export const formatCurrency = (value) => {
    if (value === undefined || value === null || value === '') return '';
    
    // Converte para float primeiro para garantir
    let numVal = value;
    if (typeof value === 'string') {
        // Se a string já estiver em formato BR (com vírgula), converte para float US
        if (value.includes(',')) {
            value = value.replace(/\./g, '').replace(',', '.');
        }
        numVal = parseFloat(value);
    }

    if (isNaN(numVal)) return '';

    return numVal.toLocaleString('pt-BR', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
    });
};

/**
 * Converte o valor do Input (BRL) ou do Banco (US) para Float puro.
 * Resolve o problema de "1000.50" virar "100050".
 */
export const parseCurrency = (value) => {
    if (value === undefined || value === null || value === '') return 0;
    
    if (typeof value === 'number') return value;
    
    const strVal = value.toString();

    // LÓGICA CRÍTICA DE DETECÇÃO:
    
    // CASO 1: Formato Brasileiro (tem vírgula decimal)
    // Ex: "1.000,50" ou "50,00"
    if (strVal.includes(',')) {
        return parseFloat(strVal.replace(/\./g, '').replace(',', '.'));
    }
    
    // CASO 2: Formato Americano/Banco (tem ponto, mas NÃO tem vírgula)
    // Ex: "1000.50" -> Deve ser mantido como 1000.50
    // O código anterior removia esse ponto achando que era milhar.
    return parseFloat(strVal); 
};