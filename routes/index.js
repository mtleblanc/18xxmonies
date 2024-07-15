const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const dataFilePath = path.join(__dirname, '../data/game-state.json');

let gameState = {
  players: {},
  companies: {},
  log: []
};

// Load game state from file
function loadGameState() {
  if (fs.existsSync(dataFilePath)) {
    const data = fs.readFileSync(dataFilePath, 'utf-8');
    gameState = JSON.parse(data);
  }
}

// Save game state to file
function saveGameState() {
  fs.writeFileSync(dataFilePath, JSON.stringify(gameState, null, 2));
}

// Broadcast the updated game state to all connected clients
function broadcastGameState(req) {
  const wss = req.app.get('wss'); // Get the WebSocket server instance from the app object
  const message = JSON.stringify({ type: 'update', data: gameState });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

loadGameState();

// Home route
router.get('/', (req, res) => {
  res.render('layout', { gameState });
});

router.post('/share-action', (req, res) => {
  const { player, company, quantity } = req.body;
  const qty = parseInt(quantity, 10);
  const price = gameState.companies[company].price;
  gameState.players[player] = gameState.players[player] || { money: 0, shares: {} };

  gameState.players[player].money -= price * qty;
  gameState.players[player].shares[company] = (gameState.players[player].shares[company] || 0) + qty;

  gameState.log.push(`${player} ${qty > 0 ? "buys" : "sells"} ${Math.abs(qty)} shares of ${company} for ${price}`);

  saveGameState();
  broadcastGameState(req);
  res.redirect('/');
});

// Route to add/remove money from a company
router.post('/update-company-money', (req, res) => {
  const { company, amount } = req.body;
  gameState.companies[company] = gameState.companies[company] || { money: 0 };

  gameState.companies[company].money += parseInt(amount, 10);
  gameState.log.push(`${company} ${amount < 0 ? "spent" : "gained"} $${Math.abs(amount)}`);
  saveGameState();
  broadcastGameState(req);
  res.redirect('/');
});

// Route to pay players per share
router.post('/pay-per-share', (req, res) => {
  const { company, amount, retains } = req.body;
  gameState.companies[company] = gameState.companies[company] || { money: 0 };

  const payout = parseInt(amount, 10);
  if (retains === 'true') {
    gameState.companies[company].money += payout * 10;
    gameState.log.push(`${company} retains ${amount * 10}`);
  } else {
    for (const player in gameState.players) {
      const shares = gameState.players[player].shares[company] || 0;
      const payment = shares * payout;
      gameState.players[player].money += payment;
    }
    gameState.log.push(`${company} pays ${amount} per share`);
  }

  gameState.companies[company].lastPayPerShare = payout;

  saveGameState();
  broadcastGameState(req);
  res.redirect('/');
});

// Route to update company price
router.post('/update-company-price', (req, res) => {
  const { company, price } = req.body;
  if (gameState.companies[company]) {
    gameState.companies[company].price = parseInt(price, 10);
    gameState.log.push(`Updated ${company} price to ${price}`);
    saveGameState();
    broadcastGameState(req);
  }
  res.redirect('/');
});

// Route to update player's money
router.post('/update-player-money', (req, res) => {
  const { player, amount } = req.body;
  gameState.players[player] = gameState.players[player] || { money: 0 };

  gameState.players[player].money += parseInt(amount, 10);
  gameState.log.push(`${player} ${amount < 0 ? "spent" : "gained"} $${Math.abs(amount)}`);

  saveGameState();
  broadcastGameState(req);
  res.redirect('/');
});

module.exports = router;
