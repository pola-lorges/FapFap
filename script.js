const RANKS = [10, 9, 8, 7, 6, 5, 4, 3];
const SUITS = [
  { symbol: '♥', name: 'Cœur', color: 'red' },
  { symbol: '♦', name: 'Carreau', color: 'red' },
  { symbol: '♣', name: 'Trèfle', color: 'black' },
  { symbol: '♠', name: 'Pique', color: 'black' }
];
const PLAYERS = ['Vous', 'Brice', 'Clarisse', 'Dieudonné'];

let state;
let cumulativeGain = 0;
let playerGains = [0, 0, 0, 0];

const $ = (selector) => document.querySelector(selector);
const formatMoney = (value) => `${Number(value).toLocaleString('fr-FR')} FCFA`;
const cardLabel = (card) => `${card.rank} ${card.suit.symbol}`;

function createDeck() {
  return SUITS.flatMap((suit) => RANKS.map((rank) => ({ ...suit, suit, rank, id: `${rank}-${suit.symbol}` })));
}

function shuffle(cards) {
  const deck = [...cards];
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [deck[index], deck[target]] = [deck[target], deck[index]];
  }
  return deck;
}

function startGame() {
  const deck = shuffle(createDeck());
  const previousWinner = state?.history?.[4]?.playerIndex;
  const nextLeader = previousWinner === undefined ? 0 : (previousWinner - 1 + PLAYERS.length) % PLAYERS.length;
  state = {
    hands: [deck.slice(0, 5), deck.slice(5, 10), deck.slice(10, 15), deck.slice(15, 20)],
    leader: nextLeader,
    turn: nextLeader,
    trick: [],
    history: [],
    round: 1,
    finished: false,
    autoWin: false,
    autoWinWinnerIndex: null
  };
  $('#result-modal').classList.add('hidden');
  render();
  if (state.turn !== 0) playComputerTurn();
}

function legalCards(playerIndex) {
  const hand = state.hands[playerIndex];
  if (!state.trick.length) return hand;
  const leadSuit = state.trick[0].card.suit;
  const suited = hand.filter((card) => card.suit.symbol === leadSuit.symbol);
  return suited.length ? suited : hand;
}

function cardStrength(card) {
  return RANKS.indexOf(card.rank);
}

function handValue(playerIndex) {
  return state.hands[playerIndex].reduce((total, card) => total + card.rank, 0);
}

function canClaimUnder21() {
  return state.hands.every((hand) => hand.length === 5) && handValue(0) <= 21;
}

function hasThreeSevens(playerIndex) {
  const sevens = state.hands[playerIndex].filter((card) => card.rank === 7);
  return sevens.length === 3 && new Set(sevens.map((card) => card.suit.symbol)).size === 3;
}

function canAutoWinWithThreeSevens() {
  return state.turn === 0 && hasThreeSevens(0);
}

function findThreeSevenWinner() {
  const winnerIndex = state.hands.findIndex((_, index) => hasThreeSevens(index));
  return winnerIndex >= 0 ? winnerIndex : null;
}

function winnerOf(trick) {
  const leadSuit = trick[0].card.suit.symbol;
  const eligible = trick.filter((play) => play.card.suit.symbol === leadSuit);
  return eligible.reduce((best, play) => cardStrength(play.card) < cardStrength(best.card) ? play : best);
}

function playCard(playerIndex, cardId) {
  if (state.finished || playerIndex !== state.turn) return;
  const cardIndex = state.hands[playerIndex].findIndex((card) => card.id === cardId);
  if (cardIndex < 0 || !legalCards(playerIndex).some((card) => card.id === cardId)) return;
  const [card] = state.hands[playerIndex].splice(cardIndex, 1);
  state.trick.push({ playerIndex, card });
  state.turn = (state.turn + 1) % 4;
  render();
  if (state.trick.length === 4) {
    window.setTimeout(resolveTrick, 700);
  } else if (state.turn !== 0) {
    window.setTimeout(playComputerTurn, 500);
  }
}

function chooseComputerCard(playerIndex) {
  const options = legalCards(playerIndex);
  if (!options.length) return null;

  if (!state.trick.length) {
    const strongOpeners = options.filter((card) => card.rank >= 8 || card.rank === 7);
    return (strongOpeners.length ? strongOpeners : options).reduce((best, card) => (
      cardStrength(card) < cardStrength(best) ? card : best
    ), strongOpeners.length ? strongOpeners[0] : options[0]);
  }

  const leadSuit = state.trick[0].card.suit.symbol;
  const currentWinner = winnerOf(state.trick);
  const winningCards = options.filter((card) => card.suit.symbol === leadSuit && cardStrength(card) < cardStrength(currentWinner.card));

  if (winningCards.length) {
    return winningCards.reduce((best, card) => (
      cardStrength(card) < cardStrength(best) ? card : best
    ), winningCards[0]);
  }

  const sameSuitCards = options.filter((card) => card.suit.symbol === leadSuit);
  if (sameSuitCards.length) {
    return sameSuitCards.reduce((worst, card) => (
      cardStrength(card) > cardStrength(worst) ? card : worst
    ), sameSuitCards[0]);
  }

  return options.reduce((worst, card) => (
    cardStrength(card) > cardStrength(worst) ? card : worst
  ), options[0]);
}

function playComputerTurn() {
  if (state.finished || state.turn === 0 || state.trick.length === 4) return;
  const card = chooseComputerCard(state.turn);
  playCard(state.turn, card.id);
}

function resolveTrick() {
  const winner = winnerOf(state.trick);
  const completed = { ...winner, trick: [...state.trick] };
  state.history.push(completed);
  state.leader = winner.playerIndex;
  state.turn = winner.playerIndex;
  state.trick = [];
  if (state.history.length === 5) {
    state.finished = true;
    render();
    showResult();
    return;
  }
  render();
  if (state.turn !== 0) window.setTimeout(playComputerTurn, 600);
}

function cardMarkup(card, played = false) {
  return `<div class="${played ? 'played-card' : 'playing-card'} ${card.color}"><span class="rank">${card.rank}</span><span class="label">${card.suit.name}</span><span class="suit">${card.suit.symbol}</span></div>`;
}

function renderHand() {
  const hand = $('#player-hand');
  const legal = legalCards(0).map((card) => card.id);
  hand.innerHTML = state.hands[0].map((card) => `<button type="button" class="playing-card ${card.color} ${legal.includes(card.id) ? '' : 'illegal'}" data-card-id="${card.id}" ${state.turn !== 0 || !legal.includes(card.id) || state.finished ? 'disabled' : ''}><span class="rank">${card.rank}</span><span class="label">${card.suit.name}</span><span class="suit">${card.suit.symbol}</span></button>`).join('');
  hand.querySelectorAll('button').forEach((button) => button.addEventListener('click', () => playCard(0, button.dataset.cardId)));
  const total = handValue(0);
  $('#hand-count').textContent = `${state.hands[0].length} carte${state.hands[0].length > 1 ? 's' : ''} · total ${total}`;
  const claimButton = $('#claim-21');
  const autoWinButton = $('#auto-win');
  const canClaim = canClaimUnder21();
  const canAutoWin = canAutoWinWithThreeSevens();
  claimButton.disabled = state.finished || !canClaim;
  claimButton.title = canClaim ? `Votre main vaut ${total} points` : 'L’annonce ≤ 21 n’est possible que si chaque joueur a 5 cartes en main.';
  autoWinButton.disabled = state.finished || !canAutoWin;
  autoWinButton.title = canAutoWin ? '3 cartes 7 différentes : victoire automatique' : 'Il faut avoir exactement 3 cartes 7 de couleurs différentes dans votre main.';
}

function renderOpponents() {
  [1, 2, 3].forEach((playerIndex) => {
    const opponent = $(`#opponent-${playerIndex}`);
    const count = state.hands[playerIndex].length;
    opponent.querySelector('small').textContent = `${count} carte${count > 1 ? 's' : ''}`;
    const backHolder = opponent.querySelector('.back-row, .back-column');
    backHolder.innerHTML = Array.from({ length: count }, () => '<span class="card-back"></span>').join('');
  });
}

function renderTrick() {
  const trickZone = $('#trick-zone');
  const visibleTrick = state.trick.length ? state.trick : state.history.at(-1)?.trick || [];
  if (!visibleTrick.length) {
    trickZone.innerHTML = '<div class="table-message">Le premier à jouer choisit la couleur.</div>';
    return;
  }
  trickZone.innerHTML = visibleTrick.map((play) => `<div title="${PLAYERS[play.playerIndex]} : ${cardLabel(play.card)}">${cardMarkup(play.card, true)}</div>`).join('');
}

function renderScore() {
  $('#leader-name').textContent = PLAYERS[state.leader];
  $('#score-list').innerHTML = PLAYERS.map((name, index) => {
    const trickCount = state.history.filter((item) => item.playerIndex === index).length;
    const gain = playerGains[index];
    return `<div class="score-row ${state.turn === index ? 'active' : ''}"><span>${name}</span><div class="score-metrics"><b>${trickCount}</b><small class="${gain < 0 ? 'negative' : ''}">${formatSignedMoney(gain)}</small></div></div>`;
  }).join('');
  const history = $('#history-list');
  history.innerHTML = state.history.length ? state.history.map((item, index) => `<div class="history-item"><span>Pli ${index + 1} · ${PLAYERS[item.playerIndex]}</span><b>${cardLabel(item.card)}</b></div>`).join('') : '<p class="empty-state">Les plis joués apparaîtront ici.</p>';
}

function render() {
  renderHand();
  renderOpponents();
  renderTrick();
  renderScore();
  const isPlayerTurn = state.turn === 0;
  $('#status-text').textContent = state.finished ? 'Manche terminée' : (isPlayerTurn ? 'À vous de jouer' : `${PLAYERS[state.turn]} joue`);
  $('#hint-text').textContent = state.finished ? 'Résultat de la manche' : (isPlayerTurn ? (state.trick.length ? `Suivez ${state.trick[0].card.suit.symbol} si possible` : 'Choisissez une carte') : 'Les adversaires réfléchissent…');
  $('#cumulative-gain').textContent = formatSignedMoney(cumulativeGain);
  $('#cumulative-gain').classList.toggle('negative', cumulativeGain < 0);
}

function formatSignedMoney(value) {
  const amount = formatMoney(Math.abs(value));
  return value < 0 ? `−${amount}` : value > 0 ? `+${amount}` : amount;
}

function updatePlayerGains(winnerIndex, stake, winMultiplier, lossMultiplier, opponentCount) {
  const winAmount = stake * winMultiplier * opponentCount;
  const lossAmount = stake * lossMultiplier;
  PLAYERS.forEach((_, index) => {
    if (index === winnerIndex) {
      playerGains[index] += winAmount;
    } else {
      playerGains[index] -= lossAmount;
    }
  });
}

function showResult() {
  const last = state.history[4];
  const previous = state.history[3];
  const autoWin = state.autoWin;
  const winnerIndex = autoWin ? state.autoWinWinnerIndex ?? 0 : last.playerIndex;
  const wonByThree = !autoWin && last.card.rank === 3;
  const multiplier = autoWin ? 1 : wonByThree && previous.card.rank === 3 ? 4 : wonByThree ? 2 : 1;
  const lossMultiplier = wonByThree ? 2 : 1;
  const opponentCount = PLAYERS.length - 1;
  const stake = Math.max(0, Number($('#stake').value) || 0);
  const won = winnerIndex === 0;
  const payout = autoWin
    ? (won ? stake * opponentCount : -stake)
    : (won ? stake * multiplier * opponentCount : -stake * lossMultiplier);
  cumulativeGain += payout;
  updatePlayerGains(winnerIndex, stake, multiplier, lossMultiplier, opponentCount);

  if (autoWin) {
    $('#result-title').textContent = `${PLAYERS[winnerIndex]} a 3 cartes 7 et gagne automatiquement`;
    $('#result-copy').textContent = `${PLAYERS[winnerIndex]} possède 3 cartes 7 dans sa main. C’est une victoire automatique.`;
  } else {
    $('#result-title').textContent = last.playerIndex === 0 ? 'Vous remportez le dernier pli' : `${PLAYERS[last.playerIndex]} prend le dernier pli`;
    $('#result-copy').textContent = `${won ? 'Victoire' : 'Défaite'} : le ${cardLabel(last.card)} ferme la manche. ${last.card.rank === 3 ? (won ? `Le 3 active un multiplicateur ×${multiplier}.` : 'Le 3 double la perte.') : 'Le multiplicateur reste à ×1.'}${won ? ` Gain multiplié par ${opponentCount} adversaires.` : ''}`;
  }

  $('#payout-value').textContent = formatSignedMoney(payout);
  $('#payout-value').classList.toggle('negative', payout < 0);
  $('#result-total').textContent = formatSignedMoney(cumulativeGain);
  $('#result-total').classList.toggle('negative', cumulativeGain < 0);
  $('#cumulative-gain').textContent = formatSignedMoney(cumulativeGain);
  $('#cumulative-gain').classList.toggle('negative', cumulativeGain < 0);
  $('#result-modal').classList.remove('hidden');
}

function claimUnder21() {
  if (state.finished || !canClaimUnder21()) return;
  state.finished = true;
  state.autoWin = true;
  state.autoWinWinnerIndex = 0;
  render();
  showResult();
}

function claimAutomaticWin() {
  if (state.finished || !canAutoWinWithThreeSevens()) return;
  state.finished = true;
  state.autoWin = true;
  state.autoWinWinnerIndex = 0;
  render();
  showResult();
}

$('#new-game').addEventListener('click', startGame);
$('#play-again').addEventListener('click', startGame);
$('#claim-21').addEventListener('click', claimUnder21);
$('#auto-win').addEventListener('click', claimAutomaticWin);
startGame();