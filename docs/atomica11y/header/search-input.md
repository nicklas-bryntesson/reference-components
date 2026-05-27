How to test a search input

GIVEN THAT I am on a page with a search input

1 - Keyboard for mobile & desktop browser

- WHEN when I use the tab key to move focus to a search input I SEE focus is strongly visually indicated
- THEN when I use the tab key to move focus to the search submit button I SEE the button is focused
- THEN when I use the enter or spacebar key I SEE the search results are presented

2 - Desktop screenreader
- WHEN I use a desktop screenreader (NVDA, JAWS, VoiceOver) AND 
- I use screen reader landmark shortcuts
  - I HEAR Its purpose is clear
  - I HEAR It identifies itself as a search input
  - I HEAR The form itself is discoverable with screenreader shortcuts as search form or landmark
- WHEN when I use the tab key to move focus to a search input I HEAR focus is strongly visually indicated

- THEN when I use the tab key to move focus to the search submit button I HEAR the button is focused

- THEN when I use the enter or spacebar key I HEAR the search results are presented

3 - Mobile screenreader
- WHEN I use a mobile screenreader AND
  - I swipe to focus on a search input
  - I HEAR Its purpose is clear
  - I HEAR It identifies itself as a search input
  - I HEAR The form itself is discoverable with screenreader shortcuts as search form or landmark

Full information: https://www.atomica11y.com/accessible-web/search/
