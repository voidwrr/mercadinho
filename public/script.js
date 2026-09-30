let carrinho = [];
let totalVenda = 0;
let produtosCache = [];

// Prepara o caixa assim que a tela abre
document.addEventListener("DOMContentLoaded", () => {
    carregarProdutos();
    configurarComprovante();
    configurarEventosTeclado();
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
        if (!resposta.ok) throw new Error('Falha ao carregar produtos');
        
        produtosCache = await resposta.json();
        const select = document.getElementById("produtoSelect");
        
        // Limpa a lista atual
        select.innerHTML = '<option value="">Selecione ou bip o produto...</option>';
        
        // Preenche com os produtos reais, código de barras e o saldo atual
        produtosCache.forEach(prod => {
            const option = document.createElement("option");
            option.value = prod.id;
            option.setAttribute("data-preco", prod.preco_venda);
            option.setAttribute("data-estoque", prod.saldo_atual);
            option.setAttribute("data-codigo", prod.codigo_barras || '');
            option.setAttribute("data-unidade", prod.unidade || 'un');

            const codigoTexto = prod.codigo_barras ? `[${prod.codigo_barras}] ` : '';
            const saldoTexto = `(Estoque: ${prod.saldo_atual} ${prod.unidade || 'un'})`;
            const precoTexto = `R$ ${Number(prod.preco_venda).toFixed(2).replace('.', ',')}`;
            
            option.innerText = `${codigoTexto}${prod.nome} ${saldoTexto} - ${precoTexto}`;
            select.appendChild(option);
        });
    } catch (erro) {
        console.error("Erro ao buscar produtos no servidor:", erro);
        alert("Erro ao carregar a lista de produtos.");
    }
}

// 2. Adiciona item no carrinho (Suporta seleção ou leitor de código de barras)
function adicionarAoCarrinho() {
    const select = document.getElementById("produtoSelect");
    const quantidadeInput = document.getElementById("quantidade");
    const produto = produtosCache.find(item => item.id === Number(select.value));

    if (!produto) {
        alert("Por favor, selecione um produto!");
        return;
    }

    const quantidade = Number(quantidadeInput.value);
    if (!adicionarProdutoAoCarrinho(produto, quantidade)) return;

    atualizarTela();
    quantidadeInput.value = 1;
    select.value = "";
    document.getElementById("codigoBarrasInput").focus();
}

function adicionarAoCarrinhoManual() {
    adicionarAoCarrinho();
}

async function adicionarPorCodigo() {
    const input = document.getElementById("codigoBarrasInput");
    const quantidadeInput = document.getElementById("qtdBarra");
    const codigo = input.value.trim();
    if (!codigo) return;

    try {
        const resposta = await fetch(`/api/produtos/codigo/${encodeURIComponent(codigo)}`);
        const resultado = await resposta.json();
        if (!resposta.ok) throw new Error(resultado.erro || "Produto não encontrado.");

        if (adicionarProdutoAoCarrinho(resultado, Number(quantidadeInput.value))) {
            atualizarTela();
            input.value = "";
            quantidadeInput.value = 1;
            input.focus();
        }
    } catch (erro) {
        alert(erro.message || "Erro ao buscar produto pelo código de barras.");
    }
}

function adicionarProdutoAoCarrinho(produto, quantidade) {
    if (!Number.isFinite(quantidade) || quantidade <= 0) {
        alert("A quantidade precisa ser maior que zero!");
        return false;
    }

    const itemExistente = carrinho.find(item => item.produto_id === produto.id);
    const quantidadeTotal = (itemExistente?.qtd || 0) + quantidade;
    const saldo = Number(produto.saldo_atual || 0);
    if (quantidadeTotal > saldo) {
        alert(`Estoque insuficiente! Disponível: ${saldo} ${produto.unidade || "un"}`);
        return false;
    }

    if (itemExistente) {
        itemExistente.qtd = quantidadeTotal;
        itemExistente.subtotal = itemExistente.qtd * itemExistente.preco;
    } else {
        const preco = Number(produto.preco_venda || 0);
        carrinho.push({
            produto_id: Number(produto.id),
            nome: produto.nome,
            unidade: produto.unidade || "un",
            qtd: quantidade,
            preco,
            desconto: 0,
            subtotal: preco * quantidade
        });
    }
    return true;
}

// 3. Atualiza a exibição da tabela e o cálculo total
function atualizarTela() {
    const tbody = document.getElementById("listaCarrinho");
    if (!tbody) return;

    tbody.innerHTML = ""; 
    totalVenda = 0;

    carrinho.forEach((item, index) => {
        totalVenda += item.subtotal;

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${item.nome}</strong></td>
            <td>R$ ${item.preco.toFixed(2).replace('.', ',')}</td>
            <td>${item.qtd} ${item.unidade}</td>
            <td><strong>R$ ${item.subtotal.toFixed(2).replace('.', ',')}</strong></td>
            <td>
                <button type="button" onclick="removerDoCarrinho(${index})" style="color: #ef4444; border: none; background: none; cursor: pointer; font-size: 16px;">🗑️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    const elQtd = document.getElementById("qtdItens");
    const elTotal = document.getElementById("valorTotal");

    if (elQtd) elQtd.innerText = carrinho.length;
    if (elTotal) elTotal.innerText = totalVenda.toFixed(2).replace('.', ',');
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

// 6. Configuração de Atalhos e Leitor de Código de Barras
function configurarEventosTeclado() {
    const select = document.getElementById("produtoSelect");
    const quantidadeInput = document.getElementById("quantidade");

    if (quantidadeInput) {
        quantidadeInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                adicionarAoCarrinho();
            }
        });
    }

    // Atalhos globais
    document.addEventListener("keydown", (e) => {
        if (e.key === "F9") {
            e.preventDefault();
            finalizarVenda();
        }
    });
}