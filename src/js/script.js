import DateField from "../partials/components/DateField/DateField";
import FileUpload from "../partials/components/FileUpload/FileUpload";
import { DateTimeField } from "../partials/components/DateTimeField/DateTimeField.ts";
import TimeField from "../partials/components/TimeField/TimeField.ts";
import MonthField from "../partials/components/MonthField/MonthField.ts";

import "../partials/components/ToggleTip/ToggleTip";

function load(entry) {
  console.log("loading...");
  entry.target.classList.add("inView");
}

DateField.attach();
FileUpload.attach();
DateTimeField.attach();
TimeField.attach();
MonthField.attach();

import('./debug-panel.js').then(({ init }) => init());
