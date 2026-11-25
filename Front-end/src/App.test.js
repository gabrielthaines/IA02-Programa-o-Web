import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { TextDecoder, TextEncoder } from 'util';
import api from './util/api';

jest.mock('./util/api', () => ({
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    getUri: ({url}) => `http://localhost:5000${url}`
}));

// React Router usa estas APIs, que o jsdom do react-scripts não fornece.
Object.assign(global, {TextDecoder, TextEncoder});
// O Jest do react-scripts não resolve o subcaminho exportado pelo React Router.
jest.mock('react-router/dom', () => {
    const {dirname, join} = require('path');
    return jest.requireActual(join(dirname(require.resolve('react-router')), 'dom-export.js'));
}, {virtual: true});
const App = require('./App').default;

const cafe = {id: 1, nome: 'Café', preco: '10.50', imagem: 'foto café.png'};
const cha = {id: 2, nome: 'Chá', preco: '5.00'};

function respostaCarrinho(itens = [], status = 'aberto', id = 7) {
    return {data: {id, status, itens}};
}

function item(produto, quantidade) {
    return {produto, produtoId: produto.id, quantidade};
}

function adicionarNaTela(nome) {
    const card = screen.getByRole('heading', {name: nome}).closest('.card');
    fireEvent.click(within(card).getByRole('button', {name: 'Adicionar'}));
}

function finalizarBotao() {
    return screen.getByRole('button', {name: 'Finalizar venda'});
}

async function abrirCarrinho() {
    api.post.mockResolvedValueOnce(respostaCarrinho())
        .mockResolvedValueOnce(respostaCarrinho([item(cafe, 1)]));
    await screen.findByRole('heading', {name: 'Café'});
    adicionarNaTela('Café');
    await screen.findByText('Total: R$ 10.50');
}

beforeEach(() => {
    window.history.replaceState({}, '', '/');
    api.get.mockResolvedValue({data: [cafe, cha]});
    jest.spyOn(window, 'alert').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

test.each(['/', '/home'])('carrega o catálogo em %s e navega para produtos', async (rota) => {
    window.history.replaceState({}, '', rota);
    render(<App />);
    expect(screen.getByRole('heading', {name: 'Painel de vendas'})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Home'})).toHaveAttribute('href', '/home');
    expect(await screen.findByRole('img', {name: 'Café'})).toHaveAttribute(
        'src', 'http://localhost:5000/uploads/foto%20caf%C3%A9.png'
    );
    expect(screen.getByText('Sem imagem')).toBeInTheDocument();
    expect(finalizarBotao()).toBeDisabled();
    expect(api.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('link', {name: 'produtos'}));
    expect(await screen.findByRole('heading', {name: 'Produtos'})).toBeInTheDocument();
    expect(window.location.pathname).toBe('/produtos');
    fireEvent.click(screen.getByRole('link', {name: 'Home'}));
    expect(await screen.findByRole('img', {name: 'Café'})).toBeInTheDocument();
    expect(window.location.pathname).toBe('/home');
});

test('usa respostas da API para alterar o carrinho, vender e iniciar outro', async () => {
    render(<App />);
    await abrirCarrinho();
    expect(api.post).toHaveBeenNthCalledWith(1, '/Carrinho/create', {});
    expect(api.post).toHaveBeenNthCalledWith(2, '/Carrinho/addItem/7', {produtoId: 1, quantidade: 1});
    const diminuir = screen.getByRole('button', {name: /Diminuir quantidade/});
    expect(diminuir).toBeDisabled();
    api.post.mockResolvedValueOnce(respostaCarrinho([item(cafe, 2)]));
    adicionarNaTela('Café');
    await screen.findByText('Total: R$ 21.00');
    expect(api.post).toHaveBeenNthCalledWith(3, '/Carrinho/addItem/7', {produtoId: 1, quantidade: 1});

    let confirmarQuantidade;
    api.patch.mockImplementationOnce(() => new Promise((resolve) => {
        confirmarQuantidade = resolve;
    }));
    fireEvent.click(diminuir);
    expect(api.patch).toHaveBeenCalledWith('/Carrinho/updateItem/7', {produtoId: 1, quantidade: 1});
    expect(screen.getByText('Total: R$ 21.00')).toBeInTheDocument();
    screen.getAllByRole('button').forEach((botao) => expect(botao).toBeDisabled());
    confirmarQuantidade(respostaCarrinho([item(cafe, 1)]));
    await screen.findByText('Total: R$ 10.50');
    api.patch.mockResolvedValueOnce(respostaCarrinho([item(cafe, 2)]));
    fireEvent.click(screen.getByRole('button', {name: /Aumentar quantidade/}));
    await screen.findByText('Total: R$ 21.00');
    expect(api.patch).toHaveBeenLastCalledWith('/Carrinho/updateItem/7', {produtoId: 1, quantidade: 2});

    api.post.mockResolvedValueOnce(respostaCarrinho([item(cafe, 2), item(cha, 1)]));
    adicionarNaTela('Chá');
    await screen.findByText('Total: R$ 26.00');
    const linhaCha = screen.getByRole('row', {name: /Chá/});
    api.delete.mockResolvedValueOnce(respostaCarrinho([item(cafe, 2)]));
    fireEvent.click(within(linhaCha).getByRole('button', {name: 'Remover'}));
    await screen.findByText('Total: R$ 21.00');
    expect(api.delete).toHaveBeenCalledWith('/Carrinho/removeItem/7/2');

    api.post.mockResolvedValueOnce(respostaCarrinho([item(cafe, 2), item(cha, 1)]));
    adicionarNaTela('Chá');
    await screen.findByText('Total: R$ 26.00');
    api.post.mockResolvedValueOnce({data: {total: '26.00'}});
    fireEvent.click(finalizarBotao());
    await screen.findByText('Carrinho vazio');
    expect(api.post).toHaveBeenLastCalledWith('/Venda/create', {carrinhoId: 7});
    expect(window.alert).toHaveBeenCalledWith('Venda realizada! Total: R$ 26.00');
    expect(finalizarBotao()).toBeDisabled();

    api.post.mockResolvedValueOnce(respostaCarrinho([], 'aberto', 8))
        .mockResolvedValueOnce(respostaCarrinho([item(cha, 1)], 'aberto', 8));
    adicionarNaTela('Chá');
    await screen.findByText('Total: R$ 5.00');
    expect(api.post).toHaveBeenLastCalledWith('/Carrinho/addItem/8', {produtoId: 2, quantidade: 1});
});

test('mantém o ID ao falhar a primeira inclusão e preserva os itens quando a venda é rejeitada', async () => {
    api.post.mockResolvedValueOnce(respostaCarrinho())
        .mockRejectedValueOnce({response: {status: 404, data: {message: 'Produto não encontrado'}}})
        .mockResolvedValueOnce(respostaCarrinho([item(cafe, 1)]));
    render(<App />);
    await screen.findByRole('heading', {name: 'Café'});
    adicionarNaTela('Café');
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Produto não encontrado'));
    expect(finalizarBotao()).toBeDisabled();
    adicionarNaTela('Café');
    await screen.findByText('Total: R$ 10.50');
    expect(api.post).toHaveBeenCalledTimes(3);
    expect(api.post).toHaveBeenLastCalledWith('/Carrinho/addItem/7', {produtoId: 1, quantidade: 1});

    api.post.mockRejectedValueOnce({response: {status: 500, data: {message: 'Erro ao registrar venda'}}});
    fireEvent.click(finalizarBotao());
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Erro ao registrar venda'));
    expect(screen.getByText('Total: R$ 10.50')).toBeInTheDocument();
    expect(finalizarBotao()).toBeEnabled();
});

test('consulta o carrinho após falhas de rede e só limpa quando a API confirma a finalização', async () => {
    render(<App />);
    await abrirCarrinho();
    api.post.mockRejectedValueOnce(new Error('Network Error'));
    api.get.mockResolvedValueOnce(respostaCarrinho([item(cafe, 1)]));
    fireEvent.click(finalizarBotao());
    await waitFor(() => expect(window.alert).toHaveBeenLastCalledWith('Erro ao finalizar a venda!'));
    expect(api.get).toHaveBeenLastCalledWith('/Carrinho/getById/7');
    expect(screen.getByText('Total: R$ 10.50')).toBeInTheDocument();
    expect(finalizarBotao()).toBeEnabled();

    api.post.mockRejectedValueOnce(new Error('Network Error'));
    api.get.mockRejectedValueOnce(new Error('Network Error'));
    fireEvent.click(finalizarBotao());
    await waitFor(() => expect(window.alert).toHaveBeenLastCalledWith(
        'Não foi possível confirmar o estado da venda. Tente novamente.'
    ));
    expect(screen.getByText('Total: R$ 10.50')).toBeInTheDocument();

    api.post.mockRejectedValueOnce({response: {status: 409}});
    api.get.mockResolvedValueOnce(respostaCarrinho([item(cafe, 1)], 'finalizado'));
    fireEvent.click(finalizarBotao());
    await screen.findByText('Carrinho vazio');
    expect(window.alert).toHaveBeenLastCalledWith('Este carrinho já foi finalizado.');
    expect(finalizarBotao()).toBeDisabled();
});
