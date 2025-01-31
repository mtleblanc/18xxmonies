document.addEventListener('DOMContentLoaded', (event) => {
  const socket = new WebSocket('ws://' + window.location.host);

  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.type === 'update') {
      updateGameState(message.data);
    }
  };

  function updatePlayer(player, data, gameState) {
    const playerRow = document.querySelector(`#player-${player}`);
    if (!playerRow) {
      location.reload();
    }
    if (playerRow) {
      playerRow.querySelector('.player-money').textContent = `${data.money}`;
      for (const company in gameState.companies) {
        const sharesCell = playerRow.querySelector(`.player-shares-${company}`);
        if (sharesCell) {
          sharesCell.querySelector('.quantity').textContent = data.shares[company] || 0;
        }
      }
    }
  }

  function updateCompany(company, data) {
    const companyElements = document.querySelectorAll(`.company-${company}`);
    if(companyElements.length == 0) {
      location.reload();
    }
    for (const companyCell of document.querySelectorAll(`.company-${company}`)) {
      const money = companyCell.querySelector('.company-money');
      money !== null && (money.textContent = `${data.money}`);
      const price = companyCell.querySelector('.company-price');
      price !== null && (price.value = data.price);
      const revenue = companyCell.querySelector('.company-last-pay');
      revenue !== null && (revenue.value = data.lastPayPerShare);
      const ipoPool = companyCell.querySelector('.company-ipo-shares');
      ipoPool !== null && (ipoPool.textContent = data.ipoShares);
      const bankPool = companyCell.querySelector('.company-bank-shares');
      bankPool !== null && (bankPool.textContent = data.bankPoolShares);
    }
  }

  function updatePrivate(key, data, gameState) {
    for (const privateRow of document.querySelectorAll(`#private-${key}`)) {
      if (!privateRow) {
        continue;
      }
      if (data.isClosed) {
        privateRow.remove();
        continue;
      }
      const ownerCell = privateRow.querySelector('.private-owner');
      ownerCell.textContent = gameState.players[data.owner]?.name || gameState.companies[data.owner]?.name || "Unowned";
    }
  }

  function updateGameState(gameState) {
    // If the player or company count is off, we need to refresh.  Might be one added, or might be new game.
    // Individual updates also make sure all are present
    if(Object.keys(gameState.players).length != document.querySelectorAll('.player-money').length ||
    Object.keys(gameState.companies).length != document.querySelectorAll('.company-money').length) {
      location.reload();
    }
    // Update player money and shares
    for (const player in gameState.players) {
      updatePlayer(player, gameState.players[player], gameState);
    }

    // Update company money and price
    for (const company in gameState.companies) {
      updateCompany(company, gameState.companies[company]);
    }

    for (const key in gameState.privates) {
      updatePrivate(key, gameState.privates[key], gameState);
    }

    // Update recent moves
    const logList = document.querySelector('#recent-moves');
    logList.innerHTML = '';
    gameState.log.slice(-10).reverse().forEach(move => {
      const li = document.createElement('li');
      li.textContent = move;
      logList.appendChild(li);
    });
  }

  function handleFormSubmit(event) {
    event.preventDefault();
    const form = event.target;
    console.log(event);
    const formData = new FormData(form);
    const attr = event.submitter?.attributes;
    const name = attr?.name?.nodeValue;
    const value = attr?.value?.nodeValue;
    if (name && value) {
      formData.append(name, value);
    }
    const action = form.action;
    const method = form.method.toUpperCase();

    fetch(action, {
      method: method,
      body: new URLSearchParams([...formData]),
    }).then(response => {
      if (response.ok) {
        console.log('Form submitted successfully');
      } else {
        console.error('Form submission failed');
      }
    }).catch(error => {
      console.error('Error submitting form:', error);
    });
  }

  const forms = document.querySelectorAll('form');
  forms.forEach(form => {
    form.addEventListener('submit', handleFormSubmit);
  });
});
