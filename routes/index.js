const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const dataFilePath = path.join(__dirname, '../data/game-state.json');
const startingPrivates = {
  sv: {
    "name": "Schuylkill Valley",
    "revenue": 5
  },
  csl: {
    "name": "Champlain & St. Lawrence",
    "revenue": 10
  },
  dh: {
    "name": "Delaware & Hudson",
    "revenue": 15
  },
  mh: {
    "name": "Mohawk & Hudson",
    "revenue": 20
  },
  ca: {
    "name": "Camden & Amboy",
    "revenue": 25
  },
  bo: {
    "name": "Baltimore & Ohio",
    "revenue": 30
  }
};

let gameState = {
  players: {},
  companies: {},
  log: [],
  privates: startingPrivates
};

// Load game state from file
function loadGameState() {
  if (fs.existsSync(dataFilePath)) {
    const data = fs.readFileSync(dataFilePath, 'utf-8');
    gameState = JSON.parse(data);
  }
}

loadGameState();

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

function saveAndBroadcast(req) {
  saveGameState();
  broadcastGameState(req);
}

function findEntity(key) {
  if (key === "bank") {
    return { name: "Bank" };
  }
  return gameState.companies[key] || gameState.players[key];
}

function parCompany(name, price) {
  const key = `company-${Object.keys(gameState.companies).length + 1}`;
  const company = {
    key: key,
    name: name,
    price: price,
    par: price,
    money: price * 10,
    lastPayPerShare: 0,
    ipoShares: 10,
    bankPoolShares: 0
  };
  gameState.companies[key] = company;
  gameState.log.push(`${company.name} opens at ${company.par}`);
}

function addPlayer(name) {
  const key = `player-${Object.keys(gameState.players).length + 1}`;
  gameState.players[key] = {
    name: name,
    money: 0,
    shares: {}
  }
}

function initialMoney(amount) {
  for (const player in gameState.players) {
    gameState.players[player].money = amount;
  }
}

function newGame() {
  const savePath = `${dataFilePath}.${new Date().toISOString()}`
  fs.writeFileSync(savePath, JSON.stringify(gameState, null, 2));
  const privates = {
    sv: {
      "name": "Schuylkill Valley",
      "revenue": 5
    },
    csl: {
      "name": "Champlain & St. Lawrence",
      "revenue": 10
    },
    dh: {
      "name": "Delaware & Hudson",
      "revenue": 15
    },
    mh: {
      "name": "Mohawk & Hudson",
      "revenue": 20
    },
    ca: {
      "name": "Camden & Amboy",
      "revenue": 25
    },
    bo: {
      "name": "Baltimore & Ohio",
      "revenue": 30
    }
  };
  gameState = {
    players: {},
    companies: {},
    log: [],
    privates: privates
  };
}

function setStockPrice(company, price) {
  company.price = price;
  gameState.log.push(`Updated ${company.name} price to ${company.price}`);
}

function addMoney(entity, amount) {
  entity.money = entity.money || 0;
  entity.money += amount;
}

function buySellStock(player, company, quantity) {
  const price = company.price || 0;
  player.shares[company.key] = (player.shares[company.key] || 0);
  company.bankPoolShares = (company.bankPoolShares || 0);
  if (quantity > 0) {
    if (company.bankPoolShares < quantity) {
      return "Not enough shares available in bank pool";
    }
  } else if (player.shares[company.key] < -quantity) {
    return "Player does not own enough shares to sell";
  }
  player.money -= price * quantity;
  player.shares[company.key] += quantity;
  company.bankPoolShares -= quantity;
  gameState.log.push(`${player.name} ${quantity > 0 ? "buys" : "sells"} ${Math.abs(quantity)} shares ` +
    `of ${company.name} for ${price} ${quantity > 0 ? "from" : "to"} bank`);
}

function ipoStock(player, company, quantity) {
  const price = company.par || 0;
  player.shares[company.key] = (player.shares[company.key] || 0);
  company.ipoShares = (company.ipoShares || 0);
  if (quantity <= 0) {
    return "Cannot sell into IPO";
  }
  if (company.ipoShares < quantity) {
    return "Not enough shares available in IPO";
  }
  player.money -= price * quantity;
  player.shares[company.key] += quantity;
  company.ipoShares -= quantity;
  gameState.log.push(`${player.name} buys ${quantity} shares ` +
    `of ${company.name} for ${price} from IPO`);
}

function dividend(company, amount) {
  for (const player in gameState.players) {
    const shares = gameState.players[player].shares[company.key] || 0;
    addMoney(gameState.players[player], shares * amount);
  }
  addMoney(company, amount * company.bankPoolShares);
  gameState.log.push(`${company.name} pays ${amount} per share`);
}

function retain(company, amount) {
  addMoney(company, amount * 10);
  gameState.log.push(`${company.name} retains ${amount * 10}`);
}

// Home route
router.get('/', (req, res) => {
  res.render('layout', { gameState });
});

router.post('/new-game', (req, res) => {
  newGame();
  saveAndBroadcast(req);
});

router.post('/add-player', (req, res) => {
  const { name } = req.body;
  addPlayer(name);
  saveAndBroadcast(req);
});

router.post('/initial-money', (req, res) => {
  const { amount } = req.body;
  const amountInt = parseInt(amount, 10);
  if (!amountInt) {
    res.status(400).end();
    return;
  }
  initialMoney(amountInt);
  saveAndBroadcast(req);
});

router.post('/share-action', (req, res) => {
  const { player, company, quantity } = req.body;
  const qty = parseInt(quantity, 10);
  if (!qty) {
    res.status(400).end();
    return;
  }
  const playerEntity = gameState.players[player];
  const companyEntity = gameState.companies[company];
  if (!playerEntity || !companyEntity) {
    res.status(404).end();
    return;
  }
  const error = buySellStock(playerEntity, companyEntity, qty)
  if (error) {
    res.statusMessage = error;
    res.status(409).end();
    return;
  }
  saveAndBroadcast(req);
  res.redirect('/');
});

router.post('/buy-ipo', (req, res) => {
  const { player, company, quantity } = req.body;
  const qty = parseInt(quantity, 10);
  if (!qty) {
    res.status(400).end();
    return;
  }
  const playerEntity = gameState.players[player];
  const companyEntity = gameState.companies[company];
  if (!playerEntity || !companyEntity) {
    res.status(404).end();
    return;
  }
  const error = ipoStock(playerEntity, companyEntity, qty)
  if (error) {
    res.statusMessage = error;
    res.status(409).end();
    return;
  }
  saveAndBroadcast(req);
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
  const payout = parseInt(amount, 10);
  if (!payout) {
    res.status(400).end();
    return;
  }
  const companyEntity = gameState.companies[company];
  if (!companyEntity) {
    res.status(404).end();
    return;
  }
  if (retains === 'true') {
    retain(companyEntity, payout);
  } else {
    dividend(companyEntity, payout)
  }

  gameState.companies[company].lastPayPerShare = payout;

  saveGameState();
  broadcastGameState(req);
  res.redirect('/');
});

router.post('/par-company', (req, res) => {
  const { name, price } = req.body;
  const priceInt = parseInt(price, 10);
  if (!priceInt) {
    res.status(400).end();
    return;
  }
  parCompany(name, priceInt);
  saveAndBroadcast(req);
});

// Route to update company price
router.post('/update-company-price', (req, res) => {
  const { company, price } = req.body;
  const priceInt = parseInt(price, 10);
  if (!priceInt) {
    res.status(400).end();
    return;
  }
  const companyObject = gameState.companies[company];
  if (!companyObject) {
    res.status(404).end();
    return;
  }
  setStockPrice(companyObject, priceInt);
  saveGameState();
  broadcastGameState(req);
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
