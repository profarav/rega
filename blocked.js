const QUOTES = [
  { text: "The successful warrior is the average man, with laser-like focus.", author: "Bruce Lee" },
  { text: "Where focus goes, energy flows.", author: "Tony Robbins" },
  { text: "You don't have to see the whole staircase, just take the first step.", author: "Martin Luther King Jr." },
  { text: "It's not that I'm so smart, it's just that I stay with problems longer.", author: "Albert Einstein" },
  { text: "Concentrate all your thoughts upon the work in hand.", author: "Alexander Graham Bell" },
  { text: "The key is not to prioritize what's on your schedule, but to schedule your priorities.", author: "Stephen Covey" },
  { text: "Do the hard jobs first. The easy jobs will take care of themselves.", author: "Dale Carnegie" },
  { text: "You will never reach your destination if you stop to throw stones at every dog that barks.", author: "Winston Churchill" },
  { text: "That's been one of my mantras — focus and simplicity.", author: "Steve Jobs" },
  { text: "Starve your distractions, feed your focus.", author: "" },
  { text: "You didn't come this far to only come this far.", author: "" },
  { text: "Dream big. Start small. Act now.", author: "" },
  { text: "The grind doesn't stop because you're tired. It stops because you're done.", author: "" },
  { text: "Your future self is watching you right now through your memories.", author: "" },
  { text: "Discipline is just choosing between what you want now and what you want most.", author: "" },
  { text: "Instagram will still be there when you're done. Your goals might not be.", author: "" },
  { text: "You're one focused session away from a breakthrough.", author: "" },
  { text: "The Wi-Fi is fast, but your dreams are faster. Get back to work.", author: "" },
  { text: "Scrolling won't finish your to-do list. Unfortunately.", author: "" },
  { text: "This tab is blocked. Your potential isn't.", author: "" },
];

const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
document.getElementById("quote-text").textContent = `"${quote.text}"`;
if (quote.author) {
  document.getElementById("quote-author").textContent = `— ${quote.author}`;
}
