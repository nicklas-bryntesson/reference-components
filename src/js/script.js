import DateField from "../partials/components/DateField/DateField";
import svSE from "../partials/components/DateField/locales/sv-SE.json"; // Vite handles JSON imports natively
import FileUpload from "../partials/components/FileUpload/FileUpload";
import { DateTimeField } from "../partials/components/DateTimeField/DateTimeField.ts";

import "../partials/components/ToggleTip/ToggleTip";

function load(entry) {
  console.log("loading...");
  entry.target.classList.add("inView");
}

DateField.registerLocale('sv-SE', svSE);
DateField.attach();
FileUpload.attach();
DateTimeField.attach();

import('./debug-panel.js').then(({ init }) => init());
