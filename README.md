## gitbranch

Github-repo branch térkép generáló, ugyanúgy mint a vs code bővítmény git-graph.
A github repository link bemásolása után láthatod a github repó, branch szerkezetét


### Fejlesztés

```bash
npm install
npm run dev     # fejlesztői szerver
npm test        # egységtesztek
npm run build   # statikus build a dist/ mappába
```

Csak publikus repók támogatottak, bejelentkezés nélkül. A gráf a GitHub REST API-ból épül
(ágonként az utolsó 300 commit), ezért névtelenül óránként 60 kérés a korlát.
