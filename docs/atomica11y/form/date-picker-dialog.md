How to test a date picker dialog

GIVEN THAT I am on a page with a date picker dialog

1 - Keyboard for mobile & desktop browser
- WHEN I use the tab key to move focus to the date dialog button I SEE focus is strongly visually indicated
- THEN when I use the spacebar and/or enter key I SEE the date picker dialog appears
- THEN when I use the arrow keys I SEE the selection moves through next/previous dates
- THEN when I use the home/end key I SEE the selection moves to the first/last day of the current week
- THEN when I use the page up/down key I SEE the grid of dates moves to the next/previous month
- THEN when I use shift key + page up/down I SEE the grid of dates moves to the next/previous year
- THEN when I use the spacebar and/or enter key I SEE the button or selection is activated
- THEN when I use the escape key I SEE the date picker dialog disappears and focus returns to the date dialog button

2 - Desktop screenreader
- WHEN I use a desktop screenreader (NVDA, JAWS, VoiceOver) AND 
- I use the tab key to move focus to the date dialog button
  - I HEAR The purpose of each control is clear
  - I HEAR Buttons identify as buttons, dialog identifies itself dialog or modal, date grid table may identify itself as table or grid
  - I HEAR The launch button indicates it has a popup, menu or dialog; days are announced with month and year
  - I HEAR Date options express state (pressed, selected, disabled/dimmed)
- THEN when I use the spacebar and/or enter key I HEAR the date picker dialog appears

- THEN when I use the arrow keys I HEAR the selection moves through next/previous dates

- THEN when I use the home/end key I HEAR the selection moves to the first/last day of the current week

- THEN when I use the page up/down key I HEAR the grid of dates moves to the next/previous month

- THEN when I use shift key + page up/down I HEAR the grid of dates moves to the next/previous year

- THEN when I use the spacebar and/or enter key I HEAR the button or selection is activated

- THEN when I use the escape key I HEAR the date picker dialog disappears and focus returns to the date dialog button

3 - Mobile screenreader
- WHEN I use a mobile screenreader AND
  - I swipe to focus on the date dialog button
  - I HEAR The purpose of each control is clear
  - I HEAR Buttons identify as buttons, dialog identifies itself dialog or modal, date grid table may identify itself as table or grid
  - I HEAR The launch button indicates it has a popup, menu or dialog; days are announced with month and year
  - I HEAR Date options express state (pressed, selected, disabled/dimmed)
- THEN when I doubletap with the button in focus I HEAR the date picker dialog appears
- THEN when I swipe through the dialog I HEAR the date options and controls come into focus
- THEN when I doubletap with the selection or button in focus I HEAR the intended action occurs

Full information: https://www.atomica11y.com/accessible-web/date-picker/
