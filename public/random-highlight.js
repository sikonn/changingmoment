document.addEventListener("DOMContentLoaded", () => {
    const paragraphs = document.querySelectorAll(".container p");
  
    paragraphs.forEach(p => {
      const words = p.innerHTML.split(" ");
      const index = Math.floor(Math.random() * words.length);
      const word = words[index];
  
      words[index] = `<span class="highlight">${word}</span>`;
      p.innerHTML = words.join(" ");
    });
  });
  