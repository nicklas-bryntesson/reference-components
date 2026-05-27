How to test a stepper input

GIVEN THAT I am on a page with a stepper input

1 - Keyboard for mobile & desktop browser
- WHEN I use the tab key to move focus to the select (+/- buttons are ignored) I SEE focus is strongly visually indicated
- THEN when I use the arrow keys to select an option I SEE the selected option is changed
- THEN when I use the escape key when the select is expanded  I SEE it collapses and focus moves to the select

2 - Desktop screenreader
- WHEN I use a desktop screenreader (NVDA, JAWS, VoiceOver) AND 
- I use the tab key to move focus to the select (+/- buttons are ignored)
  - I HEAR Its purpose is clear (+/- buttons are ignored)
  - I HEAR It identifies itself as a select, popup button, menu/submenu or combobox
  - I HEAR Its label is read with the input
  - I HEAR It indicates when the select is expanded/collapsed, indicates which option is selected
- THEN when I use the arrow keys to select an option I HEAR the selected option is changed

- THEN when I use the escape key when the select is expanded  I HEAR it collapses and focus moves to the select

3 - Mobile screenreader
- WHEN I use a mobile screenreader AND
  - I swipe to focus on the select (+/- buttons are ignored)
  - I HEAR Its purpose is clear (+/- buttons are ignored)
  - I HEAR It identifies itself as a select, popup button, menu/submenu or combobox
  - I HEAR Its label is read with the input
  - I HEAR It indicates when the select is expanded/collapsed, indicates which option is selected
- THEN when I doubletap with the select in focus I HEAR the picker/spinner expands
- THEN when I swipe to and doubletap the desired option I HEAR the picker/spnner collapses

Full information: https://www.atomica11y.com/accessible-web/stepper-input/
