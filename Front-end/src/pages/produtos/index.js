// Produtos/index.js
import { useEffect, useRef, useState } from "react";
import InputGroup from "../../components/inputGroup";
import useProduto from "../../hooks/useProduto";
import api from "../../util/api";

const Produtos = () => {

    const [produto, setProduto] = useState({
        nome: "",
        preco: ""
    });
    const [lstProdutos, setLstProdutos] = useState([]);
    const [idEdicao, setIdEdicao] = useState(null);
    const [imagem, setImagem] = useState(null);
    const formulario = useRef(null);
    const {getAll, create, getById, update, remove} = useProduto();

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
        // A carga inicial roda uma vez ao montar a página.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function validateProduto(produto) {
        if (!produto.nome.trim()) {
            alert("O nome é obrigatório!");
            return false;
        }

        if (String(produto.preco).trim() === "" ||
            !Number.isFinite(Number(produto.preco)) || Number(produto.preco) < 0) {
            alert("Informe um preço maior ou igual a zero!");
            return false;
        }

        return true;
    }


    function handleChange (e) {
        const {name, value} = e.target;
        setProduto((atual) => ({...atual, [name]: value}));
    }

    function limparImagem() {
        formulario.current.elements.imagem.value = "";
        setImagem(null);
    }

    function handleImagem(e) {
        const arquivo = e.target.files[0];
        if (arquivo) {
            const nome = arquivo.name.toLowerCase();
            const formatoValido = (nome.endsWith(".jpeg") && arquivo.type === "image/jpeg") ||
                (nome.endsWith(".png") && arquivo.type === "image/png");
            if (!formatoValido || arquivo.size > 5 * 1024 * 1024) {
                alert("Selecione uma imagem JPEG ou PNG de até 5 MiB!");
                limparImagem();
                return;
            }
        }
        setImagem(arquivo || null);
    }

    async function handleSubmit(e) {
    e.preventDefault();

    if (!validateProduto(produto)) {
        return;
    }

    try {
        const dados = new FormData();
        dados.append("nome", produto.nome);
        dados.append("preco", produto.preco);
        if (imagem) dados.append("imagem", imagem);

        if (idEdicao === null) {
            await create(dados);
            alert("Produto cadastrado com sucesso!");
        } else {
            await update(idEdicao, dados);
            alert("Produto atualizado com sucesso!");
        }

        await carregarProdutos();

        cancelarEdicao();

    } catch (err) {
        console.log(err);
        alert(err.response?.data?.message || "Erro ao salvar o produto");
    }
}

    async function handleEdit(id) {
        try {
            const produto = await getById(id);
            limparImagem();

            setProduto ({
                nome: produto.nome,
                preco: produto.preco
            });

            setIdEdicao(id);

        } catch (err) {
            console.log(err);
            alert("Erro ao buscar o produto");
        }
    }

    function cancelarEdicao() {
        limparImagem();
        setProduto({
            nome: "",
            preco: ""
         });

        setIdEdicao(null);
    }

    async function handleDelete(id) {
        if (!window.confirm("Deseja excluir este produto?")) {
            return;
        }

        try {
            await remove(id);

                if (idEdicao === id) {
                cancelarEdicao();
                }

                await carregarProdutos();

                alert("Produto excluído com sucesso!");

            }   catch (err) {
                console.log(err);
                alert("Erro ao excluir o produto");
            }
        }

    return(
        <div className="container">
            <h1 className="text-center fs-4">Produtos</h1>
            <div>
                <form ref={formulario} onSubmit={handleSubmit}>
                    <InputGroup
                    label="Nome"
                    onChange={handleChange}
                    type="text"
                    placeholder="Nome do Produto"
                    name="nome"
                    value={produto.nome}/>
                    <InputGroup label="Preço"
                    onChange={handleChange}
                    type="number"
                    placeholder="Preço do Produto"
                    name="preco"
                    min="0"
                    step="0.01"
                    value={produto.preco}/>
                    <InputGroup
                    label="Imagem"
                    onChange={handleImagem}
                    type="file"
                    name="imagem"
                    accept=".jpeg,.png"/>

                    <button type="submit" className="btn btn-primary">
                        {idEdicao === null ? "Cadastrar" : "Atualizar"}
                    </button>

                         {idEdicao !== null && (
                     <button
                        type="button"
                         className="btn btn-secondary ms-2"
                        onClick={cancelarEdicao} >
                         Cancelar
                     </button>
                    )}

                </form>
            </div>
            <table className="table table-striped mt-3">
                <thead>
                    <tr>
                        <th>Nome</th>
                        <th>Preço</th>
                        <th>Imagem</th>
                        <th>Ações</th>
                    </tr>
                </thead>
                <tbody>
                    {lstProdutos.length === 0 ? (
                        <tr>
                            <td colSpan={4} className="text-center">Nenhum produto cadastrado</td>
                        </tr>)
                        :(
                            lstProdutos.map((produto) => (
                                <tr key={produto.id}>
                                    <td>{produto.nome}</td>
                                    <td>R${produto.preco}</td>
                                    <td>
                                        {produto.imagem ? (
                                            <img
                                                src={api.getUri({url: `/uploads/${encodeURIComponent(produto.imagem)}`})}
                                                alt={`Imagem de ${produto.nome}`}
                                                width="80"
                                            />
                                        ) : "Sem imagem"}
                                    </td>
                                    <td>
                                        <button
                                            className="btn btn-warning"
                                            onClick={() => handleEdit(produto.id)}>
                                            Editar
                                        </button>
                                        <button
                                            className="btn btn-danger ms-2"
                                            onClick={() => handleDelete(produto.id)}>
                                            Excluir
                                        </button>
                                     </td>
                                </tr>
                            ))
                        )
                    }
                </tbody>
            </table>
        </div>
    )
}

export default Produtos;
