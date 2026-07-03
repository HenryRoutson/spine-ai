# MATH 301 Real Analysis — Problem Set 4 — Student: Priya Nair

## Section A — Integration and limits (20 pts)

**Q1.** Evaluate \(\int_0^1 3x^2 e^{x^3}\,dx\). Show the substitution explicitly.  
Student work: Let \(u = x^3\), so \(du = 3x^2\,dx\); the bounds transform as \(u : 0 \to 1\), giving \(\int_0^1 e^u\,du = e - 1\).

**Q2.** Compute \(\lim_{n \to \infty} \left(1 + \frac{2}{n}\right)^{n}\).  
Student work: Write \(\left(1 + \frac{2}{n}\right)^{n} = e^{n \ln(1 + 2/n)}\); since \(n \ln(1 + 2/n) \to 2\), the limit is \(e^2\).

## Section B — Series convergence (20 pts)

**Q3.** Determine whether \(\sum_{n=1}^{\infty} \frac{n!}{n^n}\) converges. Justify with a named test.  
Student work: Ratio test — \(\frac{a_{n+1}}{a_n} = \left(\frac{n}{n+1}\right)^{n} \to \frac{1}{e} < 1\), hence the series converges.

**Q4.** Prove that \(\sum_{n=2}^{\infty} \frac{1}{n \ln^2 n}\) converges.  
Student work: The terms are smaller than \(\frac{1}{n^2}\), so it converges by comparison with \(\sum \frac{1}{n^2}\).
