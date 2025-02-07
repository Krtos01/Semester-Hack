require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: "0.8.28",
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL, // Optimism Sepolia RPC URL’niz
      accounts: [process.env.PRIVATE_KEY] // Kontrat sahibi cüzdanınızın private key’i (testnet için)
    }
  }
};