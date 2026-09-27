let carrinho = [];
let totalVenda = 0;

// 1. Prepara o caixa assim que a tela abre
document.addEventListener("DOMContentLoaded", () => {
    carregarProdutos();
    configurarComprovante();
});

function configurarComprovante() {
    const opcaoComprovante = document.getElementById("enviarComprovante");
    const campoTelefone = document.getElementById("campoTelefoneComprovante");
    const telefone = document.getElementById("telefoneComprovante");

    opcaoComprovante.addEventListener("change", () => {
        campoTelefone.hidden = !opcaoComprovante.checked;
        telefone.required = opcaoComprovante.checked;
        if (!opcaoComprovante.checked) telefone.value = "";
    });
}

async function carregarProdutos() {
    try {
        const resposta = await fetch('/api/produtos');
        const produtos = await resposta.json();
        
        const select = document.getElementById("produtoSelect");
        
        // Limpa a lista atual
        select.innerHTML = '<option value="">Selecione um produto...</option>';
        
        // Preenche com os produtos reais e o saldo atual
        produtos.forEach(prod => {
            const option = document.createElement("option");
            option.value = prod.id;
            option.setAttribute("data-preco", prod.preco_venda);
            option.setAttribute("data-estoque", prod.saldo_atual);
            
            // Exibe Nome, Preço e Estoque Disponível
            option.innerText = `${prod.nome} (Estoque: ${prod.saldo_atual} ${prod.unidade}) - R$ ${prod.preco_venda.toFixed(2).replace('.', ',')}`;
            select.appendChild(option);
        });
    } catch (erro) {
        console.error("Erro ao buscar produtos no servidor:", erro);
        alert("Erro ao carregar a lista de produtos.");
    }
}

// 2. Adiciona item no carrinho
function adicionarAoCarrinho() {
    const select = document.getElementById("produtoSelect");
    const quantidadeInput = document.getElementById("quantidade");
    
    const idProduto = select.value;
    const selectedOption = select.options[select.selectedIndex];

    if (!idProduto) {
        alert("Por favor, selecione um produto!");
        return;
    }

    const nomeProduto = selectedOption.text.split(" (Estoque:")[0];
    const preco = parseFloat(selectedOption.getAttribute("data-preco"));
    const estoqueDisponivel = parseFloat(selectedOption.getAttribute("data-estoque"));
    const quantidade = parseFloat(quantidadeInput.value);

    if (isNaN(quantidade) || quantidade <= 0) {
        alert("A quantidade precisa ser maior que zero!");
        return;
    }

    // Verifica se já existe o mesmo produto no carrinho para somar a quantidade
    const itemExistente = carrinho.find(item => item.produto_id == idProduto);
    const qtdTotalDesejada = (itemExistente ? itemExistente.qtd : 0) + quantidade;

    // Validação de limite de estoque
    if (qtdTotalDesejada > estoqueDisponivel) {
        alert(`Estoque insuficiente! Disponível: ${estoqueDisponivel}`);
        return;
    }

    if (itemExistente) {
        itemExistente.qtd = qtdTotalDesejada;
        itemExistente.subtotal = itemExistente.qtd * itemExistente.preco;
    } else {
        const subtotal = preco * quantidade;
        carrinho.push({
            produto_id: Number(idProduto),
            nome: nomeProduto,
            qtd: quantidade,          // Compatível com o campo da API e do Banco
            preco: preco,             // Compatível com o campo da API e do Banco
            desconto: 0,
            subtotal: subtotal
        });
    }

    atualizarTela();
    
    // Reseta os campos do formulário
    quantidadeInput.value = 1;
    select.value = "";
}

// 3. Atualiza o visual da tabela e os totais
function atualizarTela() {
    const tbody = document.getElementById("listaCarrinho");
    tbody.innerHTML = ""; 
    totalVenda = 0;

    carrinho.forEach((item, index) => {
        totalVenda += item.subtotal;

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${item.nome}</td>
            <td>R$ ${item.preco.toFixed(2).replace('.', ',')}</td>
            <td>${item.qtd}</td>
            <td>R$ ${item.subtotal.toFixed(2).replace('.', ',')}</td>
            <td>
                <button type="button" onclick="removerDoCarrinho(${index})" style="color: red; cursor: pointer;">❌</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById("qtdItens").innerText = carrinho.length;
    document.getElementById("valorTotal").innerText = totalVenda.toFixed(2).replace('.', ',');
}

// 4. Remove um item individual do carrinho
function removerDoCarrinho(index) {
    carrinho.splice(index, 1);
    atualizarTela();
}

// 5. Finaliza a venda enviando para o Servidor
async function finalizarVenda() {
    if (carrinho.length === 0) {
        alert("O carrinho está vazio!");
        return;
    }

    const formaPagamentoSelect = document.getElementById("formaPagamento");
    const formaPagamento = formaPagamentoSelect ? formaPagamentoSelect.value : 'dinheiro';

    if (!formaPagamento) {
        alert("Selecione uma forma de pagamento!");
        return;
    }

    const enviarComprovante = document.getElementById("enviarComprovante").checked;
    const telefone = document.getElementById("telefoneComprovante").value.replace(/\D/g, "");
    let telefoneWhatsApp = "";
    let janelaWhatsApp = null;

    if (enviarComprovante) {
        if (![10, 11, 12, 13].includes(telefone.length) || (telefone.length > 11 && !telefone.startsWith("55"))) {
            alert("Informe um telefone válido com DDD.");
            return;
        }

        telefoneWhatsApp = telefone.length <= 11 ? `55${telefone}` : telefone;
        janelaWhatsApp = window.open("about:blank", "_blank");
    }

    const itensVenda = [...carrinho];
    const totalFinal = totalVenda;

    const dadosVenda = {
        subtotal: totalVenda,
        desconto: 0,
        total: totalVenda,
        forma_pagamento: formaPagamento,
        itens: carrinho
    };

    try {
        const resposta = await fetch('/api/vendas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dadosVenda)
        });

        const resultado = await resposta.json();

        if (resposta.ok) {
            if (enviarComprovante) {
                const nomesPagamento = {
                    pix: "PIX",
                    dinheiro: "Dinheiro",
                    cartao_credito: "Cartão de crédito",
                    cartao_debito: "Cartão de débito"
                };
                const linhasItens = itensVenda.map(item =>
                    `${item.qtd}x ${item.nome} - R$ ${item.subtotal.toFixed(2).replace(".", ",")}`
                );
                const mensagem = [
                    "Comprovante informativo da compra",
                    `Venda #${resultado.venda_id}`,
                    "",
                    ...linhasItens,
                    "",
                    `Total: R$ ${totalFinal.toFixed(2).replace(".", ",")}`,
                    `Pagamento: ${nomesPagamento[formaPagamento] || formaPagamento}`
                ].join("\n");
                const urlWhatsApp = `https://wa.me/${telefoneWhatsApp}?text=${encodeURIComponent(mensagem)}`;

                if (janelaWhatsApp) {
                    janelaWhatsApp.location.href = urlWhatsApp;
                } else {
                    window.location.href = urlWhatsApp;
                }
            }

            alert(`✅ Venda #${resultado.venda_id} finalizada com sucesso!`);
            carrinho = []; 
            atualizarTela(); 
            document.getElementById("enviarComprovante").checked = false;
            document.getElementById("campoTelefoneComprovante").hidden = true;
            const telefoneComprovante = document.getElementById("telefoneComprovante");
            telefoneComprovante.value = "";
            telefoneComprovante.required = false;
            carregarProdutos(); // Recarrega os produtos para atualizar o saldo do estoque no select
        } else {
            if (janelaWhatsApp) janelaWhatsApp.close();
            alert(`❌ Erro: ${resultado.erro || "Erro ao registrar a venda."}`);
        }
    } catch (erro) {
        if (janelaWhatsApp) janelaWhatsApp.close();
        alert("❌ Erro ao conectar com o servidor.");
        console.error(erro);
    }
}