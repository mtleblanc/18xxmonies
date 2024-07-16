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

function findEntity(key) {
  if (key === "bank") {
    return { name: "Bank" };
  }
  return gameState.companies[key] || gameState.players[key];
}

function addMoney(entity, amount) {
  entity.money = entity.money || 0;
  entity.money += amount;
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

  gameState.log.push(`${gameState.players[player].name} ${qty > 0 ? "buys" : "sells"} ${Math.abs(qty)} shares of ${company} for ${price}`);

  saveGameState();
  broadcastGameState(req);
  res.redirect('/');
});

// Route to add/remove money from a company
router.post('/update-company-money', (req, res) => {
  const { company, amount } = req.body;
  gameState.companies[company] = gameState.companies[company] || { money: 0 };

  addMoney(gameState.companies[company], parseInt(amount, 10));
  gameState.log.push(`${gameState.companies[company].name} ${amount < 0 ? "spent" : "gained"} $${Math.abs(amount)}`);
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
    addMoney(gameState.companies[company], payout * 10);
    gameState.log.push(`${company} retains ${amount * 10}`);
  } else {
    for (const player in gameState.players) {
      const shares = gameState.players[player].shares[company] || 0;
      const payment = shares * payout;
      addMoney(gameState.players[player], payment);
    }
    gameState.log.push(`${gameState.companies[company].name} pays ${amount} per share`);
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
    gameState.log.push(`Updated ${gameState.companies[company].name} price to ${price}`);
    saveGameState();
    broadcastGameState(req);
  }
  res.redirect('/');
});

router.post('/pay-privates', (req, res) => {
  for (const key in gameState.privates) {
    const pc = gameState.privates[key];
    if (pc.isClosed || !pc.owner) {
      continue;
    }
    const destination = findEntity(pc.owner);
    addMoney(destination, pc.revenue);
    gameState.log.push(`${destination.name} gained ${pc.revenue} from ${pc.name}`);
  }
  saveGameState();
  broadcastGameState(req);
  res.redirect('/');
});

router.post('/sell-private', (req, res) => {
  const { key, target, price } = req.body;
  const pc = gameState.privates[key];
  const source = findEntity(pc.owner);
  const dest = findEntity(target);
  const amount = parseInt(price, 10);
  pc.owner = target;
  if (source) {
    addMoney(source, amount);
  }
  addMoney(dest, -amount);
  gameState.log.push(`${pc.name} sold from ${source?.name || "Unowned"} to ${dest.name} for ${amount}`);

  saveGameState();
  broadcastGameState(req);
  res.redirect('/');
});

router.post('/close-private', (req, res) => {
  const { key } = req.body;
  const pc = gameState.privates[key];
  pc.isClosed = true;
  gameState.log.push(`${pc.name} closed`);
  saveGameState();
  broadcastGameState(req);
  res.redirect('/');
});

router.post('/transfer', (req, res) => {
  const { source, target, amount: amountString } = req.body;
  console.log(req.body);
  let sourceEntity = findEntity(source);
  let targetEntity = findEntity(target);
  let amount = parseInt(amountString, 10);
  if (!sourceEntity || !targetEntity || !amount) {
    res.status(400).end();
    return;
  }
  addMoney(sourceEntity, -amount);
  addMoney(targetEntity, amount);
  gameState.log.push(`${amount} transferred from ${sourceEntity.name} to ${targetEntity.name}`);
  saveGameState();
  broadcastGameState(req);
  res.redirect('/');
});

// Route to update player's money
router.post('/update-player-money', (req, res) => {
  const { player, amount } = req.body;
  gameState.players[player] = gameState.players[player] || { money: 0 };
  gameState.players[player].money = gameState.players[player].money || 0;
  gameState.players[player].money += parseInt(amount, 10);
  gameState.log.push(`${player} ${amount < 0 ? "spent" : "gained"} $${Math.abs(amount)}`);

  saveGameState();
  broadcastGameState(req);
  res.redirect('/');
});

module.exports = router;
