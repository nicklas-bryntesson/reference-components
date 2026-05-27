How to test a hint, help, or error

GIVEN THAT I am on a page with a hint, help, or error

1 - Keyboard for mobile & desktop browser
- WHEN I use the tab key to move focus to an input I SEE hint, help or error text meets size and contrast requirements

2 - Desktop screenreader
- WHEN I use a desktop screenreader (NVDA, JAWS, VoiceOver) AND 
- I use the tab key to move focus to an input
  - I HEAR After the input name, role and state is read, the hint, help or error is read
  - I HEAR When it appears dynamically, an error is read automatically
3 - Mobile screenreader
- WHEN I use a mobile screenreader AND
  - I swipe to focus on an input
  - I HEAR After the input name, role and state is read, the hint, help or error is read
  - I HEAR When it appears dynamically, an error is read automatically

Full information: https://www.atomica11y.com/accessible-web/hint-help-error/
