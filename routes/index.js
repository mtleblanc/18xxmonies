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
  res.render('layout', { gameState });
});

// Route to handle buying shares
router.post('/buy-share', (req, res) => {
  const { player, company } = req.body;
  const price = gameState.companies[company].price;
  gameState.players[player] = gameState.players[player] || { money: 0, shares: {} };
  gameState.companies[company] = gameState.companies[company] || { money: 0 };

  gameState.players[player].money -= price;
  gameState.players[player].shares[company] = (gameState.players[player].shares[company] || 0) + 1;

  gameState.companies[company].money += price;
  gameState.log.push(`Player ${player} bought a share of ${company} for ${price}`);

  saveGameState();
  res.redirect('/');
});

// Route to handle selling shares
router.post('/sell-share', (req, res) => {
  const { player, company } = req.body;
  const price = gameState.companies[company].price;
  gameState.players[player] = gameState.players[player] || { money: 0, shares: {} };
  gameState.companies[company] = gameState.companies[company] || { money: 0 };

  gameState.players[player].money += price;
  gameState.players[player].shares[company] = (gameState.players[player].shares[company] || 1) - 1;

  gameState.companies[company].money -= price;
  gameState.log.push(`Player ${player} sold a share of ${company} for ${price}`);

  saveGameState();
  res.redirect('/');
});

// Route to add/remove money from a company
router.post('/update-company-money', (req, res) => {
  const { company, amount } = req.body;
  gameState.companies[company] = gameState.companies[company] || { money: 0 };

  gameState.companies[company].money += parseInt(amount, 10);
  gameState.log.push(`${company} ${amount < 0 ? "spent" : "gained"} $${Math.abs(amount)}`);
  saveGameState();
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
      gameState.log.push(`${company} pays ${amount} per share`);
    }
  }

  gameState.companies[company].lastPayPerShare = payout;

  saveGameState();
  res.redirect('/');
});

// Route to update company price
router.post('/update-company-price', (req, res) => {
  const { company, price } = req.body;
  if (gameState.companies[company]) {
    gameState.companies[company].price = parseInt(price, 10);
    gameState.log.push(`Updated ${company} price to ${price}`);
    saveGameState();
  }
  res.redirect('/');
});

module.exports = router;
