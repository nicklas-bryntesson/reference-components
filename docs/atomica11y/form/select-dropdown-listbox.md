How to test a select dropdown listbox

GIVEN THAT I am on a page with a select dropdown listbox

1 - Keyboard for mobile & desktop browser
- WHEN I use the tab key to move focus to a select I SEE focus is strongly visually indicated
- THEN when I use the arrow keys to select an option I SEE the selected option is changed
- THEN when I use the escape key when the select is open  I SEE it collapses and focus moves to the select

2 - Desktop screenreader
- WHEN I use a desktop screenreader (NVDA, JAWS, VoiceOver) AND 
- I use the tab key to move focus to a select
  - I HEAR Its purpose is clear
  - I HEAR It identifies itself as a select, popup, menu/submenu, listbox or combobox
  - I HEAR Hints or errors are read after the label and related inputs include a group name (ex: Account settings)
  - I HEAR It indicates which option is selected and if disabled/dimmed/unavailable
- THEN when I use the arrow keys to select an option I HEAR the selected option is changed

- THEN when I use the escape key when the select is open  I HEAR it collapses and focus moves to the select

3 - Mobile screenreader
- WHEN I use a mobile screenreader AND
  - I swipe to focus on a select
  - I HEAR Its purpose is clear
  - I HEAR It identifies itself as a select, popup, menu/submenu, listbox or combobox
  - I HEAR Hints or errors are read after the label and related inputs include a group name (ex: Account settings)
  - I HEAR It indicates which option is selected and if disabled/dimmed/unavailable
- THEN when I doubletap with the select in focus I HEAR the options can be selected

Full information: https://www.atomica11y.com/accessible-web/select/
