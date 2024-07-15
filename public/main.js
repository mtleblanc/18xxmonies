document.addEventListener('DOMContentLoaded', (event) => {
  const socket = new WebSocket('ws://' + window.location.host);

  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.type === 'update') {
      updateGameState(message.data);
    }
  };

  function updateGameState(gameState) {
    // Update player money and shares
    for (const player in gameState.players) {
      const playerRow = document.querySelector(`#player-${player}`);
      if (playerRow) {
        playerRow.querySelector('.player-money').textContent = `${gameState.players[player].money}`;
        for (const company in gameState.companies) {
          const sharesCell = playerRow.querySelector(`.player-shares-${company}`);
          if (sharesCell) {
            sharesCell.querySelector('.quantity').textContent = gameState.players[player].shares[company] || 0;
          }
        }
      }
    }

    // Update company money and price
    for (const company in gameState.companies) {
      const companyCell = document.querySelector(`#company-${company}`);
      if (companyCell) {
        companyCell.querySelector('.company-money').textContent = `${gameState.companies[company].money}`;
        companyCell.querySelector('.company-price').value = gameState.companies[company].price;
        companyCell.querySelector('.company-last-pay').value = gameState.companies[company].lastPayPerShare;
      }
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
    const formData = new FormData(form);
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
