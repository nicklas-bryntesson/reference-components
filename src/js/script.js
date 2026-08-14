import DateField from "../partials/components/DateField/DateField";
import FileUpload from "../partials/components/FileUpload/FileUpload";
import { DateTimeField } from "../partials/components/DateTimeField/DateTimeField.ts";
import TimeField from "../partials/components/TimeField/TimeField.ts";
import MonthField from "../partials/components/MonthField/MonthField.ts";
import WeekField from "../partials/components/WeekField/WeekField.ts";
import AffixField from "../partials/components/AffixField/AffixField.ts";
import MotionRegion from "../partials/components/MotionRegion/MotionRegion.ts";
import ScrollArea from "../partials/components/ScrollArea/ScrollArea.ts";
import ThemeSwitch from "../partials/components/ThemeSwitch/ThemeSwitch.ts";

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
WeekField.attach();
AffixField.attach();
MotionRegion.attach();
ScrollArea.attach();
ThemeSwitch.attach();

// Kitchensink-only: mirror ThemeSwitch's resolved state into its readout table.
// This is also the worked example of why `theme-change` exists — a host listens
// for it to keep something else (a chart, a map, <meta name="theme-color">) in
// step with the appearance.
{
  const table = document.querySelector('#ThemeSwitch-readout');
  const live = document.querySelector('.ThemeSwitch[data-component="ThemeSwitch"]');
  if (table && live) {
    const cell = (name) => table.querySelector(`[data-readout="${name}"]`);
    const render = ({ preference, appearance }) => {
      cell('preference').textContent = preference;
      cell('appearance').textContent = appearance;
      cell('prefers-dark').textContent = String(
        window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
      );
      cell('attribute').textContent =
        document.documentElement.getAttribute('data-appearance') ?? '(absent — follows the OS)';
    };
    live.addEventListener('theme-change', (e) => render(e.detail));
    // The component projects (and dispatches) during attach, before this
    // listener existed, so paint the initial state once by hand.
    const stored = window.localStorage?.getItem(ThemeSwitch.STORAGE_KEY);
    const preference = ['light', 'dark'].includes(stored) ? stored : 'system';
    render({
      preference,
      appearance: preference === 'system'
        ? (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : preference,
    });
    window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', () => {
      render({
        preference: cell('preference').textContent,
        appearance: document.documentElement.getAttribute('data-appearance')
          ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
      });
    });
  }
}

import('./debug-panel.js').then(({ init }) => init());
