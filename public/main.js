document.addEventListener('DOMContentLoaded', (event) => {
    const socket = new WebSocket('ws://' + window.location.host);
  
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'update') {
        updateGameState(message.data);
      }
    };
  
    function updateGameState(gameState) {
        location.reload();
    }
  });
  