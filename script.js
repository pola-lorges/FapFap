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
    autoWin: false
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
  const lastTrick = state.history.length === 4;
  if (lastTrick) return options.find((card) => card.rank === 3) || options[options.length - 1];
  const threes = options.filter((card) => card.rank === 3);
  if (threes.length && Math.random() < 0.75) return options.find((card) => card.rank !== 3) || threes[0];
  return options[Math.floor(Math.random() * options.length)];
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
  claimButton.disabled = state.finished || total > 21;
  claimButton.title = total <= 21 ? `Votre main vaut ${total} points` : `Votre main vaut ${total} points`;
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
  $('#score-list').innerHTML = PLAYERS.map((name, index) => `<div class="score-row ${state.turn === index ? 'active' : ''}"><span>${name}</span><b>${state.history.filter((item) => item.playerIndex === index).length}</b></div>`).join('');
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

function showResult() {
  const last = state.history[4];
  const previous = state.history[3];
  const autoWin = state.autoWin;
  const multiplier = autoWin ? 1 : last.card.rank === 3 && previous.card.rank === 3 ? 4 : last.card.rank === 3 ? 2 : 1;
  const opponentCount = PLAYERS.length - 1;
  const stake = Math.max(0, Number($('#stake').value) || 0);
  const won = autoWin || last.playerIndex === 0;
  const lossMultiplier = !won && last.card.rank === 3 ? 2 : 1;
  const payout = won ? stake * multiplier * opponentCount : -stake * lossMultiplier;
  cumulativeGain += payout;
  $('#result-title').textContent = autoWin ? 'Annonce réussie : vous gagnez' : last.playerIndex === 0 ? 'Vous remportez le dernier pli' : `${PLAYERS[last.playerIndex]} prend le dernier pli`;
  $('#result-copy').textContent = autoWin ? `Victoire automatique : votre main totalise ${handValue(0)} points, soit 21 ou moins. Gain multiplié par ${opponentCount} adversaires.` : `${won ? 'Victoire' : 'Défaite'} : le ${cardLabel(last.card)} ferme la manche. ${last.card.rank === 3 ? (won ? `Le 3 active un multiplicateur ×${multiplier}.` : 'Le 3 double la perte.') : 'Le multiplicateur reste à ×1.'}${won ? ` Gain multiplié par ${opponentCount} adversaires.` : ''}`;
  $('#payout-value').textContent = formatSignedMoney(payout);
  $('#payout-value').classList.toggle('negative', payout < 0);
  $('#result-total').textContent = formatSignedMoney(cumulativeGain);
  $('#result-total').classList.toggle('negative', cumulativeGain < 0);
  $('#cumulative-gain').textContent = formatSignedMoney(cumulativeGain);
  $('#cumulative-gain').classList.toggle('negative', cumulativeGain < 0);
  $('#result-modal').classList.remove('hidden');
}

function claimUnder21() {
  if (state.finished || handValue(0) > 21) return;
  state.finished = true;
  state.autoWin = true;
  render();
  showResult();
}

$('#new-game').addEventListener('click', startGame);
$('#play-again').addEventListener('click', startGame);
$('#claim-21').addEventListener('click', claimUnder21);
startGame();