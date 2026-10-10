/* Donation Bar */
/* by lunazera */
/* ********* */
/* ********* */

'use strict';

/* Globals *******************************************************************/
const slime2 = window.slime2;

const Widget = {
	readAccount: { id: '' },
	values: new Map(),
};

let ws;  // will contain our websocket connection

let barType;  // Type setting of bar  = Widget.values.get('bar-type')

let GOAL = 0;  // value of Goal bar
let amount = "$0";  // value of amount progressed in goal bar

// The Bar percentage filled is calculated by calculatePercentage() using
// ((amount-amountOffset) / (GOAL - amountOFfset)) * 100

let wssData = "$0";  // Data stored from websocket

// Milestone list.
// Assumes list of number, string
let MilestoneList = "";
let ParsedMilestoneList;
let MilestoneIndex = 0;


/* Slime2 Event Listeners *****************************************************************/

addEventListener('slime2:widget-values', widgetValuesListener);
addEventListener('slime2:widget-accounts', widgetAccountsListener);
addEventListener('slime2:twitch-event', twitchEventListener);
addEventListener('slime2:widget-button-click', widgetButtonClickListener);

/* Buttons *******************************************************************/
function widgetButtonClickListener(event) {
	if (event.detail.id === 'ws-reconnect') {
		closeWebsocket();
		// setTimeout(function() {
		// 	connect();
		// }, 1000);
	}
}

/* Values changing (this runs every time widget value changes *******************************************************************/
function widgetValuesListener(event) {
	Widget.values = new Map(Object.entries(event.detail));  // Loads widget values in

	/// Load in data into 'amount'
	// If server connect is off, use our test value instead for "amount"
	// If server connect is toggled back on, loads whatever was last in websocket data
	if (Widget.values.get('server-connect') ?? false) {
		amount = wssData;
	} else {
		amount = "$" + Widget.values.get('test-amount-val') ?? 500;
	}

	updateMilestones(amount);

	/// Load in data into 'Goal'
	updateGoal();
	
	// Update Text and the Progress Bar
	updateProgressBar(amount);
	writeText();

	// Set reference to widget ID
	const widgetElement = document.getElementById('widget');

	// Functions to process and set CSS from widget settings
	// use in CSS as var(--custom-[cssVarName])
	function setCustomCSS(cssVarName, value) {
		widgetElement.style.setProperty(`--custom-${cssVarName}`, value);
	}

	function addClass(...classes) {
		widgetElement.classList.add(...classes);
	}

	function removeClass(...classes) {
		widgetElement.classList.remove(...classes);
	}

	function toggleClass(className, force) {
		widgetElement.classList.toggle(className, force);
	}

	// text settings
	[
		// quotation marks around font name is necessary
		// to handle font names that contain spaces
		['font-name', `"${Widget.values.get('font-name') ?? 'Inter'}"`],
		['text-color', Widget.values.get('text-color') ?? 'red'],
		['font-size', `${Widget.values.get('font-size') ?? 14}px`],
		['font-weight', Widget.values.get('font-weight') ?? 'normal'],
		['text-background-color', Widget.values.get('text-background-color') ?? 'white'],
		['text-background-border-radius', `${Widget.values.get('text-background-border-radius') ?? 5}px`],
	].forEach(([cssVarName, value]) => {
		setCustomCSS(cssVarName, value);
	});

	// bar settings
	[
		// quotation marks around font name is necessary
		// to handle font names that contain spaces
		['border-radius', `${Widget.values.get('border-radius') ?? 5}px`],
		['bar-color', Widget.values.get('bar-color') ?? 'white'],
		['bar-fill-color', Widget.values.get('bar-fill-color') ?? 'red'],
		['bar-border-color', Widget.values.get('bar-border-color') ?? 'white'],
		['bar-border-size', `${Widget.values.get('bar-border-size') ?? 5}px`],
		['bar-height', `${Widget.values.get('bar-height') ?? 25}px`],
		['bar-width', `${Widget.values.get('bar-width') ?? 500}px`]
	].forEach(([cssVarName, value]) => {
		setCustomCSS(cssVarName, value);
	});
}

/* Widget account load listener (this runs once) *******************************************************************/
function widgetAccountsListener(event) {
	const accounts = event.detail?.accounts ?? [];

	Widget.readAccount = accounts[0] ?? Widget.readAccount;
	connect();
}

/* Twitch event Listeners *******************************************************************/
function twitchEventListener(event) {
	const { type, data } = event.detail;

	// https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/
	// event.detail.data = event of each of these EventSub payloads
	switch (type) {
		// chat
		case 'channel.chat.message':
		case 'channel.chat.message_delete':
		case 'channel.chat.clear':
		case 'channel.chat.clear_user_messages':
		case 'channel.chat.notification':

		// follow
		case 'channel.follow':

		// raid
		case 'channel.raid':

		// shoutout
		case 'channel.shoutout.create':

		// channel points
		case 'channel.channel_points_custom_reward_redemption.add':
		case 'channel.channel_points_automatic_reward_redemption.add':

		// hype train
		case 'channel.hype_train.begin':
		case 'channel.hype_train.progress':
		case 'channel.hype_train.end':

		// bits
		case 'channel.bits.use':
		case 'channel.cheer':
		case 'channel.custom_power_up_redemption.add':

		// ad break
		case 'channel.ad_break.begin':

		// subscriptions
		case 'channel.subscribe':
		case 'channel.subscription.gift':
		case 'channel.subscription.message':

		// polls
		case 'channel.poll.begin':
		case 'channel.poll.progress':
		case 'channel.poll.end':

		// predictions
		case 'channel.prediction.begin':
		case 'channel.prediction.progress':
		case 'channel.prediction.lock':
		case 'channel.prediction.end':

		// charity
		case 'channel.charity_campaign.donate':
		case 'channel.charity_campaign.start':
		case 'channel.charity_campaign.progress':
		case 'channel.charity_campaign.stop':

		// goal
		case 'channel.goal.begin':
		case 'channel.goal.progress':
		case 'channel.goal.end':
	}
}


/* Websocket Connection *******************************************************************/
function connect() {
	const WEBSOCKET_URL = Widget.values.get("wss-url") ?? '';  // gets URL from widgets
	if (typeof ws === 'undefined') {
		// check if websocket has been defined already
		tryWebsocket(WEBSOCKET_URL);
	}
	if (ws.readyState === 3) {
		tryWebsocket(WEBSOCKET_URL);
	}
	// switch(ws.readyState) {
	// 	case 0:
	// 		// Still connecting
	// 		break;
	// 	case 1:
	// 		// Open
	// 		console.log("Websocket is currently open!");
	// 		break;
	// 	case 2:
	// 		// Closing
	// 		console.log("Websocket is trying to close");
	// 		break;
	// 	case 3:
	// 		// Closed or couldn't open
	// 		console.log("Websocket is closed or failed to connect.");

	// 		break;
	// }
	ws.onmessage = wsOnMessage;
	ws.onclose = wsOnClose;
	ws.onerror = wsOnError;
}

function tryWebsocket(url) {
	if (url !== '') {
		// If URL is entered
		console.log("Connecting to websocket server: " + url);
		ws = new WebSocket(url);
	} else {
		console.log("Websocket URL was empty");
	}
}

function closeWebsocket() {
	if (typeof ws !== 'undefined') {
		// check if websocket has been defined already
		ws.close();
		console.log("Closing websocket!");
	}
}

/* Websocket Events *******************************************************************/
var wsOnMessage = function(event) {
	wssData = event.data;
	amount = event.data;

	updateMilestones(amount);
	updateGoal();
	updateProgressBar(amount);
}

var wsOnClose = function(e) {
	console.log("Socket closed. Reconnecting in 5 seconds...", e.reason);
	setTimeout(connect, 5000);
};

var wsOnError = function(err) {
	console.error("WebSocket error observed:", err);
};
 

/* Helpers *******************************************************************/

const progressBar = document.getElementById('progress-bar');
const currentText = document.getElementById('current-amount');
const goalText = document.getElementById('goal-amount');

const textTitle = document.getElementById("text-title");
const textAbove = document.getElementById("text-above");
const textBelow = document.getElementById("text-below");


/* Progress Bar *******************************************************************/

/// Update Goal value
function updateGoal() {
	switch(Widget.values.get('bar-type')) {
		case 'bar-goal':
			// Bar set to "single goal"
			GOAL = Widget.values.get('goal') ?? 0;
			break;
		case 'bar-milestone':
			// Bar set to milestones
			GOAL = getMilestoneAmount(MilestoneIndex);
			break;
	}
	// Update goal text
	goalText.innerText = `$${GOAL.toFixed(2)}`;
}

/// Calculates percentage of amount progressed against goal
function calculatePercentage(amount, goal, offset) {
	// ((amount-amountOffset) / (GOAL - amountOFfset)) * 100
	// or of the form
	// ((a - x) / (b - x)) * 100
	return Math.min(Math.max(((amount - offset) / (goal - offset)) * 100, 0), 100);
}

// Updates Progress bar and text on screen
function updateProgressBar(amountString) {
	const currentAmount = parseFloat(amountString.replace(/[$,]/g, ''));  // Check string as "$200"
	if (isNaN(currentAmount)) {
		currentAmount = 0;
		return;
	}

	// Check for bar offset
	let offset = 0;
	if ((Widget.values.get('rescale-bar-toggle') ?? false)) {
		// If true, we'll apply an offset to the bar

		if (Widget.values.get('bar-type') === 'bar-goal') {
			// If we're in the "goal" type bar, offset by widget defined amount
			offset = Widget.values.get('offset-amount');

		} else if (Widget.values.get('bar-type') === 'bar-milestone') {
			// If we're in the milestone type, offset by milestone amount

			if (MilestoneIndex > 0) {
				// only do this if we're past the first index
				offset = getPreviousMilestoneAmount();
			}
		}
	}

	// Calculate percentage and apply that to progress bar width
	progressBar.style.width = `${calculatePercentage(currentAmount, GOAL, offset)}%`;

	// Change text
	currentText.innerText = amountString; 
}


/* Milestones *******************************************************************/

/// Reads and parses the milestone list for usage
function readMilestoneList() {
	let parsedList = '';
	MilestoneList = Widget.values.get('milestone-list') ?? '';
	if (MilestoneList != '') {
		// split by first delimiter level
		parsedList = MilestoneList.split('\n').reduce( (newArr, element, i) => {
			// split by second delimiter level
			let subList = element.split(',');
			newArr[i] = subList;

			return newArr;
		}, []);
	}

	ParsedMilestoneList = parsedList.sort(function(a,b) {
		return a[0]-b[0]
	});

	return parsedList;
}

/// Gets milestone amount from index and returns float
function getMilestoneAmount(index) {
	return parseFloat(ParsedMilestoneList[index][0]);
}

/// Gets milestone text from index
function getMilestoneText(index) {
	return ParsedMilestoneList[index][1];
}

/// Gets previous milestone amount based on stored current index
function getPreviousMilestoneAmount() {
	if (MilestoneIndex > 0) {
		return getMilestoneAmount(MilestoneIndex - 1)
	} else {
		return getMilestoneAmount(0);
	}
}

/// Finds the next milestone based on amount, and updates Milestone Index
function findNextMilestone(val) {
	// First check if its a string format or number already
	let currentAmount = 0;
	if (typeof val === 'string') {
		currentAmount = parseFloat(val.replace(/[$,]/g, ''));  // Check string for "$200"
		if (isNaN(currentAmount)) {
			currentAmount = 0;
			return;
		}
	} else {
		currentAmount = val;
	}

	// Now parse through list
	for (var i=0; i < ParsedMilestoneList.length; i++) {
		var amount = getMilestoneAmount(i);

		MilestoneIndex = i;

		if (currentAmount < amount) {
			break;
		}
	}
}

/// Update loop to run for milestones
function updateMilestones(amount) {
	readMilestoneList();
	findNextMilestone(amount);
	writeText();
}


/* Other Text *******************************************************************/

/// Writes text into document
function writeText() {
	switch(Widget.values.get('bar-type') ?? '' ) {
		case 'bar-goal':
			textAbove.textContent =  Widget.values.get('text-above-bar');
			textBelow.textContent =  Widget.values.get('text-below-bar');
			break;
		case 'bar-milestone':
			if (MilestoneIndex === 0) {
				textAbove.textContent = "";
				textBelow.textContent =  Widget.values.get('text-below-bar') + getMilestoneText(MilestoneIndex);
			} else {
				textAbove.textContent =  Widget.values.get('text-above-bar')  + getMilestoneText(MilestoneIndex - 1);
				textBelow.textContent =  Widget.values.get('text-below-bar')  + getMilestoneText(MilestoneIndex);
			}
			break;
	}
	textTitle.textContent = Widget.values.get('bar-text-title') ?? '';
}