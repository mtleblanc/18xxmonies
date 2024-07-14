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

loadGameState();

// Home route
router.get('/', (req, res) => {
  res.render('index', { gameState });
});

// Route to handle buying shares
router.post('/buy-share', (req, res) => {
  const { player, company, price } = req.body;
  gameState.players[player] = gameState.players[player] || { money: 0, shares: {} };
  gameState.companies[company] = gameState.companies[company] || { money: 0 };

  gameState.players[player].money -= parseInt(price, 10);
  gameState.players[player].shares[company] = (gameState.players[player].shares[company] || 0) + 1;

  gameState.companies[company].money += parseInt(price, 10);
  gameState.log.push(`Player ${player} bought a share of ${company} for ${price}`);

  saveGameState();
  res.redirect('/');
});

// Route to handle selling shares
router.post('/sell-share', (req, res) => {
  const { player, company, price } = req.body;
  gameState.players[player] = gameState.players[player] || { money: 0, shares: {} };
  gameState.companies[company] = gameState.companies[company] || { money: 0 };

  gameState.players[player].money += parseInt(price, 10);
  gameState.players[player].shares[company] = (gameState.players[player].shares[company] || 1) - 1;

  gameState.companies[company].money -= parseInt(price, 10);
  gameState.log.push(`Player ${player} sold a share of ${company} for ${price}`);

  saveGameState();
  res.redirect('/');
});

// Route to add/remove money from a company
router.post('/update-company-money', (req, res) => {
  const { company, amount } = req.body;
  gameState.companies[company] = gameState.companies[company] || { money: 0 };

  gameState.companies[company].money += parseInt(amount, 10);
  gameState.log.push(`Updated ${company} money by ${amount}`);

  saveGameState();
  res.redirect('/');
});

// Route to pay players per share
router.post('/pay-per-share', (req, res) => {
  const { company, amount } = req.body;
  gameState.companies[company] = gameState.companies[company] || { money: 0 };

  const payout = parseInt(amount, 10);
  for (const player in gameState.players) {
    const shares = gameState.players[player].shares[company] || 0;
    const payment = shares * payout;
    gameState.players[player].money += payment;
    gameState.companies[company].money -= payment;
  }

  gameState.log.push(`Paid ${amount} per share for ${company}`);

  saveGameState();
  res.redirect('/');
});

module.exports = router;
