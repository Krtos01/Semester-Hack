require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { JsonRpcProvider } = require('ethers');
const { ethers } = require('ethers');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

// Statik dosyaları sunmak için:
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = path.join(__dirname, 'uploads');
      if (!fs.existsSync(uploadPath)){
          fs.mkdirSync(uploadPath);
      }
      cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
      cb(null, Date.now() + '-' + file.originalname);
    }
  });
  const upload = multer({ storage });

  // Ethereum sağlayıcısını ayarlıyoruz:
const provider = new JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// Kontrat adresini ve ABI’yi tanımlayın:
const contractAddress = process.env.CONTRACT_ADDRESS; // Deploy ettiğiniz kontrat adresi, .env'e ekleyin
const contractABI = [
  // Sadece mintNFT fonksiyonunun tanımını ekliyoruz:
  "function mintNFT(address recipient, string memory tokenURI) public returns (uint256)"
];

const myNFTContract = new ethers.Contract(contractAddress, contractABI, wallet);

app.post('/create-nft', upload.single('image'), async (req, res) => {
    try {
      // Formdan gelen veriler:
      const { name, description, walletAddress } = req.body;
        const recipient = walletAddress; // walletAddress'i kullan
        const date = new Date().toISOString();
        console.log("Mintleme için adres:", recipient);
      const imagePath = req.file.path;
      
      // Metadata oluşturma:
      const metadata = {
        name,
        date,
        description,
        image: `http://localhost:${port}/${imagePath}` // Geliştirme ortamı için yerel URL
      };
      console.log("Mint işlemi başladı...");
      // Metadata bilgisini JSON dosyası olarak kaydediyoruz:
      const metadataPath = imagePath + '.json';
      fs.writeFileSync(metadataPath, JSON.stringify(metadata));
  
      // Metadata'nın URL'sini oluşturun:
      const metadataURL = `http://localhost:${port}/${metadataPath}`;
  
      // Akıllı kontrata mintNFT çağrısı yaparak NFT oluşturma:
      const tx = await myNFTContract.mintNFT(recipient, metadataURL);
      console.log("Mint işlemi gönderildi, bekleniyor...", tx.hash);
      await tx.wait();
      
      
      
      res.json({ success: true, txHash: tx.hash, metadataURL });
      console.log("Mint işlemi tamamlandı!");

    } catch (error) {
        console.error("Minting sırasında hata oluştu:", error);
        console.error("Hata detayları:", error.reason || error.message || error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/generate-qr/:tokenId', async (req, res) => {
    const tokenId = req.params.tokenId;
    // QR kod tarandığında açılacak URL:
    const claimUrl = `http://localhost:${port}/claim?tokenId=${tokenId}`;
    try {
      const qrCodeDataURL = await QRCode.toDataURL(claimUrl);
      res.json({ success: true, qrCode: qrCodeDataURL });
    } catch (error) {
        console.error("QR sırasında hata oluştu:", error);
        console.error("Hata detayları:", error.reason || error.message || error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/claim', async (req, res) => {
    const { tokenId, recipient } = req.query;
    if (!recipient) {
      return res.status(400).json({ success: false, error: "Recipient address is required." });
    }
  
    // Burada, front-end üzerinden wallet bağlantısı sağlanıp, NFT transfer işlemi gerçekleştirilebilir.
    // Örneğin, eğer NFT’nin sahibi siz iseniz, ERC721’nin transferFrom fonksiyonunu kullanarak transfer edebilirsiniz.
    // Ancak mint işlemi zaten belirlenen adrese yapıldığı için bu kısım geliştirmeye açıktır.
    res.json({ success: true, message: `NFT (tokenId: ${tokenId}) ${recipient} adresine transfer edilecek (işlemi burada tanımlayın).` });
  });
  
  app.get('/claim', async (req, res) => {
    const { tokenId, recipient } = req.query;
    
    if (!recipient) {
      return res.status(400).json({ success: false, error: "Recipient address is required." });
    }
  
    try {
      // Transfer işlemi: TransferFrom kullanılarak NFT transferi yapılacak.
      const tx = await myNFTContract.transferFrom(wallet.address, recipient, tokenId);
      console.log("NFT transfer işlemi başladı...");
      await tx.wait(); // Transfer işlemi tamamlanana kadar bekleyin.
      
      // NFT transfer işlemi başarılı olduktan sonra görüntüle
      const metadataURL = `http://localhost:${port}/uploads/${tokenId}.json`;
      const metadataResponse = await fetch(metadataURL);
      const metadata = await metadataResponse.json();
  
      // Kullanıcıya başarı mesajı ile birlikte NFT’nin fotoğrafı ve metadata’sını göster
      res.json({ 
        success: true, 
        message: `NFT (tokenId: ${tokenId}) ${recipient} adresine transfer edildi.`,
        image: metadata.image,
        name: metadata.name,
        description: metadata.description
      });
    } catch (error) {
      console.error("NFT transferi sırasında hata oluştu:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app.listen(port, () => {
    console.log(`Sunucu http://localhost:${port} adresinde çalışıyor.`);
  });

  app.get('/', (req, res) => {
    res.send('Ana sayfaya hoş geldiniz!');
  });

  