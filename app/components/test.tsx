"use client"
import React, { useState } from 'react';

interface PropriedadesDemonstracao {
  valorInicial: number;
}

export const DemonstracaoBiblioteca: React.FC<PropriedadesDemonstracao> = ({ valorInicial }) => {
  const [resultadoAtual, definirResultadoAtual] = useState<number>(valorInicial);

  const executarBiblioteca = () => {
    // Aqui você chama o código real da sua biblioteca para rodar no navegador do usuário
    // const novoResultado = suaFuncaoManeira(resultadoAtual);
    definirResultadoAtual(resultadoAtual + 1); 
  };

  return (
    <div style={{ padding: '1rem', border: '1px solid #eaeaea', borderRadius: '8px' }}>
      <p>Resultado processado em tempo real: {resultadoAtual}</p>
      <button onClick={executarBiblioteca}>
        Executar Função
      </button>
    </div>
  );
};