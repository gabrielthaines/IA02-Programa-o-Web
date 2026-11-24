const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');

const uploads = path.join(__dirname, '../uploads');
fs.mkdirSync(uploads, { recursive: true });

const assinaturas = {
    '.jpeg': Buffer.from([0xff, 0xd8, 0xff]),
    '.png': Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
};

class FormatoImagemInvalido extends Error {
    constructor() {
        super('Apenas imagens JPEG e PNG válidas são permitidas!');
    }
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploads);
    },

    filename: function (req, file, cb) {
        cb(null, randomUUID() + path.extname(file.originalname).toLowerCase());
    }
});

const imageUpload = multer({
    storage: storage,

    fileFilter: function (req, file, cb) {
        const extensao = path.extname(file.originalname).toLowerCase();

        if (
            (extensao === '.jpeg' && file.mimetype === 'image/jpeg') ||
            (extensao === '.png' && file.mimetype === 'image/png')
        ) {
            cb(null, true);
        } else {
            cb(new FormatoImagemInvalido());
        }
    },

    limits: {
        fileSize: 5 * 1024 * 1024
    }
});

async function validarImagem(file) {
    if (!file) return;

    const assinatura = assinaturas[path.extname(file.filename)];
    const arquivo = await fs.promises.open(file.path, 'r');
    try {
        const cabecalho = Buffer.alloc(assinatura.length);
        const { bytesRead } = await arquivo.read(cabecalho);
        if (bytesRead !== assinatura.length || !cabecalho.equals(assinatura)) {
            throw new FormatoImagemInvalido();
        }
    } finally {
        await arquivo.close();
    }
}

async function removerImagem(nome) {
    if (typeof nome !== 'string' || !/^[a-z0-9_-]+\.(jpeg|png)$/i.test(nome)) return;

    await fs.promises.unlink(path.join(uploads, nome)).catch((err) => {
        if (err.code !== 'ENOENT') throw err;
    });
}

module.exports = { imageUpload, validarImagem, removerImagem, FormatoImagemInvalido };
