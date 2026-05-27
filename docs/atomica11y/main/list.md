How to test a list

GIVEN THAT I am on a page with a list

1 - Keyboard for mobile & desktop browser
- WHEN I use the arrow key to browse to a list I SEE the list comes into view
- WHEN when I use the tab key I SEE nothing happens to the list itself because lists must NOT be focusable

2 - Desktop screenreader
- WHEN I use a desktop screenreader (NVDA, JAWS, VoiceOver) AND 
- I use the arrow key to browse to a list
  - I HEAR It identifies itself as a list
  - I HEAR It declares the number of items in the list
- WHEN when I use the tab key I HEAR nothing happens to the list itself because lists must NOT be focusable

3 - Mobile screenreader
- WHEN I use a mobile screenreader AND
  - I swipe to browse a list
  - I HEAR It identifies itself as a list
  - I HEAR It declares the number of items in the list

Full information: https://www.atomica11y.com/accessible-web/list/
