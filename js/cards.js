import {
  cards_data,
  CARD_ART_HIDDEN_ON_LOAD,
  cards_by_rarity,
} from "./main.js";
import { updateDetailsDialog, DETAILS_DIALOG_A11Y } from "./dialog.js";

const CARD_IMAGES_URL = `../images/Card Images`;
const HIGHEST_Z_INDEX = 10;
let card_z_index = HIGHEST_Z_INDEX;
let gacha_display_selection;
let lastCardClicked;
let secondToLastCardClicked;

export const GACHA_VIEW_SETTING = document.querySelectorAll(
  'input[name="gacha-display"]'
);
export const GACHA_MOTION_SETTING = document.querySelectorAll(
  'input[name="gacha-reduce-motion"]'
);
export const GACHA_SECTION = document.getElementById("gacha-controls");

//Custom Card component. Use it like this:
//<tcg-card card-id="[COLLECTOR_NUMBER]"></tcg-card>
export async function defineCardComponent() {
  let html = await fetch("../card.html");
  html = await html.text();

  class Card extends HTMLElement {
    data = {};
    front;
    back;

    constructor() {
      super();
      this.data = cards_data.find(
        (card) => card["Collector Number"] == this.getAttribute("card-id")
      );
      if (this.data["Rarity Folder"] === "Element") {
        //Copies the data variable by value.
        //That way we can change the ID here while keeping the original intact.
        this.data = Object.assign({}, this.data);
        this.data["Collector Number"] = "000";
      }
      this.innerHTML = html;
      this.holder = this.getElementsByClassName("card-component")[0];
      this.front = this.getElementsByClassName("card-front")[0];
      this.front.setAttribute("aria-label", this.getSubtitleText());
      this.back = this.getElementsByClassName("card-back")[0];
      this.image = this.getElementsByClassName("card-image")[0];
      this.image.style.backgroundImage = 'url("' + this.getImageURL() + '")';
      this.image.classList.add(setCardRarity(this.data["Rarity Folder"]));
      this.subtitle = this.getElementsByClassName("card-subtitle")[0];
      this.subtitle.textContent = this.getSubtitleText();
      this.setupOnClickEvents();
      if (CARD_ART_HIDDEN_ON_LOAD) {
        this.setupCardForGacha();
        this.subtitle.classList.add("hidden");
      }
    }

    //Returns an url of the form:
    //`https://${DOMAIN}/images/Card Images/${RARITY}/${FILENAME}.jpg`
    getImageURL() {
      return `${CARD_IMAGES_URL}/${this.data["Rarity Folder"]}/${this.data["Filename"]}`;
    }

    setupCardForGacha() {
      // The back of the card is automatically hidden for the collections page
      // We have to reset it for the gacha so that it can be clicked on
      this.back.classList.remove("hidden");
      // With card back shown, make card front inaccessible, just like it is for mouse users
      this.front.tabIndex = "-1";
      this.front.setAttribute("aria-hidden", "true");
    }

    flipCard() {
      // update the next value for the zIndex
      card_z_index++;

      // register as a clicked card, add class to animate flip-over, and make card front accessible again
      this.classList.add("clicked");
      this.holder.classList.add("flip");
      this.front.removeAttribute("tabindex");
      this.front.removeAttribute("aria-hidden");
      this.back.tabIndex = "-1";
      this.back.setAttribute("aria-hidden", "true");
      // have screenreader announce the card name
      document.getElementById("pull-announcement").textContent =
        this.getSubtitleText();

      // Start the animation and update the z-index when the animation starts
      // This is to stack any opened cards in the reverse order
      this.addEventListener("animationstart", updateZIndex);
      // animation optimization: inform browser that we are changing the following properties
      this.image.style.willChange =
        "transform, filter, opacity, background-position";
      this.image.classList.add("opened");
      this.image.classList.add("animated");

      // remove the previous hover effects only if the gacha is not displayed as a grid
      if (gacha_display_selection !== "gacha-grid") {
        this.addEventListener("animationend", addUnclickableToCardsExceptLast);
      } else {
        this.subtitle.style.willChange = "opacity";
        this.subtitle.classList.remove("hidden");
        // update value back after animation
        let currentSubtitle = this.subtitle;
        this.subtitle.addEventListener("animationend", function () {
          currentSubtitle.style.willChange = "auto";
        });
      }

      // for optimization purposes, only animate two at a time.
      if (secondToLastCardClicked) {
        secondToLastCardClicked.image.classList.remove("animated");
        // only add unclickable when in deck mode. otherwise we get a random assortment of uninteractable cards in grid mode
        if (gacha_display_selection != "gacha-grid") {
          secondToLastCardClicked.front.classList.add("unclickable");
        }
      }
      secondToLastCardClicked = lastCardClicked;
      lastCardClicked = this;

      // check if we pulled all possible cards. if yes, display the roll again prompt
      if (
        document.getElementsByClassName("clicked").length ===
        document.getElementsByTagName("tcg-card").length
      ) {
        // reset memory of clicked cards
        lastCardClicked = undefined;
        secondToLastCardClicked = undefined;
        document
          .getElementById("gacha-prompt-roll-again")
          .classList.remove("hidden");
      }
    }

    //Binds the card's onclick events to flip and show the description popup.
    setupOnClickEvents() {
      this.back.onclick = (event) => this.flipCard();
      // if not gacha it will show the extra card information
      if (!CARD_ART_HIDDEN_ON_LOAD) {
        this.front.onclick = (event) => this.showDetails();
      }
    }

    showDetails() {
      updateDetailsDialog(this.data, this.getImageURL());
      DETAILS_DIALOG_A11Y.show();
    }

    getSubtitleText() {
      return `${this.data["Collector Number"].padStart(3, "0")} ${
        this.data["Card Display Name"]
      } (${this.data["Rarity Folder"]})`;
    }
  }
  customElements.define("tcg-card", Card);
}

function addAnimation(e) {
  let target = e.target;
  // if our target is the parent button (from keyboard focus, then target the child image after)
  if (target.className.includes("card-front")) {
    target = e.target.querySelector('.card-image');
  }

  if (location.href.includes("/gacha") || target.className.includes("details-dialog-card")) {
    // animation optimization: inform browser that we are changing the following properties
    target.style.willChange = "transform, filter, opacity, background-position";
    // apply the animated class to start the CSS animation
    target.classList.add("animated");
  }
}
function removeAnimation (e) {
  let target = e.target;
  // if our target is the parent button (from keyboard blur, then target the child image after)
  if (target.className.includes("card-front")) {
    target = e.target.querySelector('.card-image');
  }
  target.classList.remove("animated");
  target.style.willChange = "auto";
}
function updateZIndex(e) {
  e.target.style.zIndex = card_z_index;
  // we don't want this to update again when reanimating later
  e.target.removeEventListener("animationstart", updateZIndex);
}
function setupHover() {
  // setup the initial event listeners for all cards
  let cardList = document.getElementsByClassName("card-image");
  for (let i = 0; i < cardList.length; i++) {
    cardList[i].addEventListener("animationend", removeAnimation);
    cardList[i].parentElement.addEventListener("blur", removeAnimation);
    cardList[i].parentElement.addEventListener("mouseover", addAnimation);
    cardList[i].parentElement.addEventListener("focus", addAnimation);
    cardList[i].parentElement.addEventListener("click", addAnimation);
  }
}
export function updateGachaView(e) {
  gacha_display_selection = e.target.value;
  if (gacha_display_selection == "gacha-grid") {
    // make this a grid
    GACHA_SECTION.classList.add("grid-display");
    GACHA_SECTION.classList.remove("pile-display");
    // we want all cards to be clickable now
    removeUnclickableFromCards();
    // hide visually since flipped cards will have subtitle below them
    document
      .getElementById("pull-announcement")
      .classList.add("visually-hidden");
    // only show subtitle on flipped cards
    Array.from(document.getElementsByClassName("clicked")).forEach(
      (element) => {
        element
          .getElementsByClassName("card-subtitle")[0]
          .classList.remove("hidden");
      }
    );
  } else {
    // make this a pile
    GACHA_SECTION.classList.remove("grid-display");
    GACHA_SECTION.classList.add("pile-display");
    // we want lower cards to be unclickable
    addUnclickableToCardsExceptLast();
    Array.from(document.getElementsByClassName("card-subtitle")).forEach(
      (element) => {
        element.classList.add("hidden");
      }
    );
    // show pull announcement text visually since cards will not have subtitles below them
    document
      .getElementById("pull-announcement")
      .classList.remove("visually-hidden");
  }


  // show the open all button if grid, mobile and opened once
  if(GACHA_SECTION.classList.contains("pulled")){
    toggleOpenAllButton();
  }
}
export function updateGachaMotion() {
  // get the list of cards
  let cardImageList = document.getElementsByClassName("card-image");
  let cardList = document.getElementsByTagName("tcg-card");
  // get the card prompt
  let rollPrompt;
  if (document.getElementsByClassName("gacha-prompt") !== null) {
    rollPrompt = document.getElementsByClassName("gacha-prompt")[0];
  }
  if (document.getElementById("gacha-prompt-roll-again") !== null) {
    rollPrompt = document.getElementById("gacha-prompt-roll-again");
  }
  // see the checkbox settings
  if (GACHA_MOTION_SETTING[0].checked) {
    // remove motion from all cards
    for (let i = 0; i < cardImageList.length; i++) {
      cardImageList[i].classList.add("reduced-motion");
      cardList[i].classList.add("reduced-motion");
    }
    // update the roll prompt/roll again prompt
    if (rollPrompt !== undefined) {
      rollPrompt.getElementsByTagName("img")[0].src =
        "../images/slimenolooptransparent.png";
      rollPrompt.getElementsByTagName("img")[0].alt =
        "Cultare slime smiling happily";
    }
    // update the button wiggle, but wait for it to be added first
    setTimeout(function () {
      if (document.getElementsByClassName("gacha-button") !== null) {
        document
          .getElementsByClassName("gacha-button")[0]
          .classList.add("reduced-motion");
      }
    }, 100);
  } else {
    // add motion to all cards
    for (let i = 0; i < cardImageList.length; i++) {
      cardImageList[i].classList.remove("reduced-motion");
      cardList[i].classList.remove("reduced-motion");
    }
    // update the roll prompt/roll again prompt
    if (rollPrompt !== undefined) {
      rollPrompt.getElementsByTagName("img")[0].src =
        "../images/slimelooptransparent.gif";
      rollPrompt.getElementsByTagName("img")[0].alt =
        "Cultare slime bouncing up and down";
    }
    // update the button wiggle, but wait for it to be added first
    setTimeout(function () {
      if (document.getElementsByClassName("gacha-button") !== null) {
        document
          .getElementsByClassName("gacha-button")[0]
          .classList.remove("reduced-motion");
      }
    }, 100);
  }
}
export function removeUnclickableFromCards() {
  // remove any unclickable classes from all the opened cards, so all can be interacted with
  // this is only used when changing the card from a grid to a pile layout
  let clickedCard = document.getElementsByClassName("opened");
  for (let i = 0; i < clickedCard.length; i++) {
    clickedCard[i].classList.remove("unclickable");
    clickedCard[i].parentElement.classList.remove("unclickable");
    clickedCard[i].parentElement.removeAttribute("tabindex");
    clickedCard[i].parentElement.removeAttribute("aria-hidden");
  }
}
export function addUnclickableToCardsExceptLast() {
  // check the current format is not grid
  if (gacha_display_selection !== "gacha-grid") {
    // this is the parent card container
    let allFlippedCards = document.getElementsByClassName("clicked");
    // this is the specific child the animation is applied to
    let clickedCard = document.getElementsByClassName("opened");
    // apply this to all the clicked cards, except the one with the z-index matching the current recorded z-index value
    for (let i = 0; i < allFlippedCards.length; i++) {
      let z = window.getComputedStyle(allFlippedCards[i]).zIndex;
      // the card with the matching z-index is the most recently flipped card at the top of the pile - this should still animate so won't have the unclickable class
      // while the unmatching ones are beneath the most recently flipped card, so should have any unclickable class removed
      if (parseInt(z) !== card_z_index) {
        clickedCard[i].classList.add("unclickable");
        clickedCard[i].parentElement.classList.add("unclickable");
        clickedCard[i].parentElement.tabIndex = "-1";
        clickedCard[i].parentElement.setAttribute("aria-hidden", "true");
      } else {
        clickedCard[i].classList.remove("unclickable");
        clickedCard[i].parentElement.classList.remove("unclickable");
      }
    }
  }
}
function toggleOpenAllButton() {
  // if the current layout is a grid, there has been at least one pull, and the screen size only allows 1 card width
  // then show the open all button, otherwise keep it hidden
  if(document.getElementById("gacha-grid").checked && innerWidth < 810){
    document.getElementById("card-list").style.paddingTop = "50px";
    document.getElementById("gacha-open-all").classList.remove("hidden");
  } else {
    document.getElementById("card-list").style.paddingTop = "30px";
    document.getElementById("gacha-open-all").classList.add("hidden");
  }
}

function openAllCards(){
  let allCardsOpened = "";
  let cardList = document.getElementsByClassName("card-component");
  document.getElementById("gacha-open-all").classList.add("hidden");
  for (let i = 0; i < cardList.length; i++) {
    // parent element
    cardList[i].parentElement.classList.add("clicked");
    cardList[i].parentElement.style.zIndex = card_z_index;
    card_z_index++;
    // card component
    cardList[i].classList.add("flip");
    // front
    // we do not need to read all of the fronts, so not changing anything
    // back
    cardList[i].getElementsByClassName("card-back")[0].tabIndex = "-1";
    cardList[i].getElementsByClassName("card-back")[0].setAttribute("aria-hidden", "true");
    // image
    cardList[i].getElementsByClassName("card-image")[0].classList.add("opened");
    // subtitle
    cardList[i].parentElement.getElementsByClassName("card-subtitle")[0].classList.remove("hidden");
    allCardsOpened += "Card " + (i + 1) + ": "
    allCardsOpened += cardList[i].parentElement.getElementsByClassName("card-subtitle")[0].innerHTML
    if(i < (cardList.length - 1)){
      allCardsOpened += ", ";
    } else {
      allCardsOpened += ".";
    }
  }
  // hide the button and fix the section height
  document.getElementById("gacha-prompt-roll-again").classList.remove("hidden");
  document.getElementById("card-list").style.paddingTop = "30px";
  // have screenreader announce the card names of all cards
  document.getElementById("pull-announcement").textContent = allCardsOpened;
}

//Renders a list of cards in the element specified in htmlLocation.
//If replace is true, overwrites all elements inside htmlLocation.
//else, adds the cards to the rest of the inner content.
export function renderCards(cards, htmlLocation, replace = false) {
  if (replace) {
    htmlLocation.innerHTML = "";
    // only on the gacha page
    if (document.getElementById("gacha-controls") !== null) {
      // reset the z-index to the highest on the closed pile
      card_z_index = HIGHEST_Z_INDEX;
      // reset the subtitle in the pile display
      document.getElementById("pull-announcement").textContent = "";
      document.getElementById("gacha-controls").classList.add("pulled");
      // add the button
      htmlLocation.innerHTML = '<div id="gacha-open-all" class="hidden"><button id="open-all-cards">Open All Cards</button></div>';
    }
  }
  for (let i = 0; i < cards.length; i++) {
    htmlLocation.insertAdjacentHTML(
      "beforeend",
      `<tcg-card card-id="${cards[i]["Collector Number"]}"></tcg-card>`
    );
  }
  // setup hover for all cards
  setupHover();

  // only on the gacha page, but we want to do this after cards are added
  if (document.getElementById("gacha-controls") !== null) {
    // update the motion settings based on the checkbox
    updateGachaMotion();
    document.getElementById("gacha-open-all").addEventListener("click", openAllCards);

    // show the Open All if card grid 
    toggleOpenAllButton();
  }
}

export function setCardRarity(folder) {
  let rarity;
  switch (folder) {
    case "HoloRare":
      rarity = "holo";
      break;
    case "UltraRare":
      rarity = "ultra";
      break;
    case "SecretRare":
      rarity = "secret";
      break;
    default:
      rarity = "basic";
      break;
  }
  return rarity;
}
