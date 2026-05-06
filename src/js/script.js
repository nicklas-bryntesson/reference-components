import DateField from "../partials/components/DateField/DateField";
import svSE from "../partials/components/DateField/locales/sv-SE.json"; // Vite handles JSON imports natively

import "../partials/components/ToggleTip/ToggleTip";

function load(entry) {
  console.log("loading...");
  entry.target.classList.add("inView");
}

DateField.registerLocale('sv-SE', svSE);
DateField.attach();

import('./debug-panel.js').then(({ init }) => init());
