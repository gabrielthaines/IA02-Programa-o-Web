import { useEffect, useRef, useState } from "react";
import useProduto from "../../hooks/useProduto";
import api from "../../util/api";

const Home = () => {
    const [lstProdutos, setLstProdutos] = useState([]);
    const [carrinho, setCarrinho] = useState([]);
    const [carrinhoId, setCarrinhoId] = useState(null);
    const [ocupado, setOcupado] = useState(false);
    const requisicaoEmAndamento = useRef(false);
    const {getAll} = useProduto();

    async function carregarProdutos() {
        try {
            const produtos = await getAll();
            setLstProdutos(produtos);
        } catch (err) {
            console.log(err);
            alert("Erro ao buscar os produtos");
        }
    }

    useEffect(() => {
        carregarProdutos();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function atualizarCarrinho(dados) {
        setCarrinho(dados.itens.map((item) => ({
            ...item.produto,
            quantidade: item.quantidade
        })));
    }

    async function executarOperacao(operacao, mensagemErro) {
        if (requisicaoEmAndamento.current) return;

        requisicaoEmAndamento.current = true;
        setOcupado(true);
        try {
            await operacao();
        } catch (err) {
            alert(err.response?.data?.message || mensagemErro);
        } finally {
            requisicaoEmAndamento.current = false;
            setOcupado(false);
        }
    }

    function adicionarProduto(produto) {
        return executarOperacao(async () => {
            let id = carrinhoId;
            if (id === null) {
                const {data} = await api.post("/Carrinho/create", {});
                id = data.id;
                setCarrinhoId(id);
            }
            const {data} = await api.post(`/Carrinho/addItem/${id}`, {
                produtoId: produto.id,
                quantidade: 1
            });
            atualizarCarrinho(data);
        }, "Erro ao adicionar o produto!");
    }

    function alterarQuantidade(item, valor) {
        return executarOperacao(async () => {
            const {data} = await api.patch(`/Carrinho/updateItem/${carrinhoId}`, {
                produtoId: item.id,
                quantidade: Math.max(1, item.quantidade + valor)
            });
            atualizarCarrinho(data);
        }, "Erro ao alterar a quantidade!");
    }

    function removerProduto(id) {
        return executarOperacao(async () => {
            const {data} = await api.delete(`/Carrinho/removeItem/${carrinhoId}/${id}`);
            atualizarCarrinho(data);
        }, "Erro ao remover o produto!");
    }

    function subtotalEmCentavos(item) {
        return Math.round(Number(item.preco) * 100) * item.quantidade;
    }

    const total = carrinho.reduce((soma, item) => soma + subtotalEmCentavos(item), 0) / 100;

    function finalizarVenda() {
        if (carrinhoId === null || carrinho.length === 0) return;

        return executarOperacao(async () => {
            let venda;
            try {
                const {data} = await api.post("/Venda/create", {carrinhoId});
                venda = data;
            } catch (err) {
                if (err.response && err.response.status !== 409) throw err;

                let dadosCarrinho;
                try {
                    const {data} = await api.get(`/Carrinho/getById/${carrinhoId}`);
                    dadosCarrinho = data;
                } catch {
                    if (err.response) throw err;
                    alert("Não foi possível confirmar o estado da venda. Tente novamente.");
                    return;
                }

                if (dadosCarrinho.status !== "finalizado") {
                    atualizarCarrinho(dadosCarrinho);
                    throw err;
                }
            }

            setCarrinho([]);
            setCarrinhoId(null);
            alert(venda
                ? `Venda realizada! Total: R$ ${Number(venda.total).toFixed(2)}`
                : "Este carrinho já foi finalizado.");
        }, "Erro ao finalizar a venda!");
    }

    return (
        <div className="container mt-3">
            <h1 className="text-center fs-4">Painel de vendas</h1>

            <div className="row">
                <div className="col-md-7">
                    <h2 className="fs-5">Produtos</h2>
                    <div className="row">
                        {lstProdutos.length === 0 && <p>Nenhum produto cadastrado</p>}
                        {lstProdutos.map((produto) => (
                            <div className="col-sm-6 mb-3" key={produto.id}>
                                <div className="card h-100">
                                    <div className="card-body">
                                        {produto.imagem ? (
                                            <img
                                                src={api.getUri({url: `/uploads/${encodeURIComponent(produto.imagem)}`})}
                                                alt={produto.nome}
                                                width="100"
                                                className="img-fluid mb-2"
                                            />
                                        ) : <p>Sem imagem</p>}
                                        <h3 className="fs-6">{produto.nome}</h3>
                                        <p>R$ {Number(produto.preco).toFixed(2)}</p>
                                        <button className="btn btn-primary"
                                            disabled={ocupado}
                                            onClick={() => adicionarProduto(produto)}>
                                            Adicionar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="col-md-5">
                    <h2 className="fs-5">Carrinho</h2>
                    {carrinho.length === 0 ? <p>Carrinho vazio</p> : (
                        <div className="table-responsive">
                            <table className="table table-striped">
                                <thead>
                                    <tr>
                                        <th>Produto</th>
                                        <th>Qtd.</th>
                                        <th>Subtotal</th>
                                        <th>Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {carrinho.map((item) => (
                                        <tr key={item.id}>
                                            <td>{item.nome}</td>
                                            <td>
                                                <button className="btn btn-secondary btn-sm"
                                                    aria-label={`Diminuir quantidade de ${item.nome}`}
                                                    disabled={ocupado || item.quantidade === 1}
                                                    onClick={() => alterarQuantidade(item, -1)}>-</button>
                                                <span className="mx-2">{item.quantidade}</span>
                                                <button className="btn btn-secondary btn-sm"
                                                    aria-label={`Aumentar quantidade de ${item.nome}`}
                                                    disabled={ocupado}
                                                    onClick={() => alterarQuantidade(item, 1)}>+</button>
                                            </td>
                                            <td>R$ {(subtotalEmCentavos(item) / 100).toFixed(2)}</td>
                                            <td>
                                                <button className="btn btn-danger btn-sm"
                                                    disabled={ocupado}
                                                    onClick={() => removerProduto(item.id)}>
                                                    Remover
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    <h3 className="fs-5">Total: R$ {total.toFixed(2)}</h3>
                    <button className="btn btn-success"
                        disabled={ocupado || carrinho.length === 0}
                        onClick={finalizarVenda}>
                        Finalizar venda
                    </button>
                </div>
            </div>
        </div>
    );
}

export default Home;
