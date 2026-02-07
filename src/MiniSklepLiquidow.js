

import { useState, useEffect } from "react";
import bg from "./assets/bg-liquid.png";

const SHEET_API =
  "https://script.google.com/macros/s/AKfycbzPgRErO3jnA2HCJEQxgiBto3_CfercvP3QHsx3PLiqRdw7ZtNsdkeFcrIwm8ut48PU/exec";

export default function MiniSklepLiquidow() {
  const [serverInventory, setServerInventory] = useState({});
  const [name, setName] = useState("");
  const [selectedFlavor, setSelectedFlavor] = useState(null);
  const [ml, setMl] = useState("");
  const [strength, setStrength] = useState(null);
  const [base, setBase] = useState(null);
  const [cart, setCart] = useState([]);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [isSending, setIsSending] = useState(false);

  const showMessage = (txt, type = "info") => {
    setMessage(txt);
    setMessageType(type);
    setTimeout(() => setMessage(""), 3000);
  };

  // ================= FETCH INVENTORY =================
  useEffect(() => {
    const fetchInventory = () => {
      fetch(SHEET_API)
        .then((r) => r.json())
        .then((d) => setServerInventory(d))
        .catch(console.error);
    };

    fetchInventory();
    const interval = setInterval(fetchInventory, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (strength === 36 && base === "nikotyna") setBase(null);
  }, [strength, base]);

  useEffect(() => {
    if (base === "nikotyna" && strength === 36) setStrength(null);
  }, [base, strength]);

  // ================= MAGAZYN =================
  const getReservedInCart = (flavorId) =>
    cart
      .filter((i) => i.flavor.id === flavorId)
      .reduce((s, i) => s + i.ml / 10, 0);

  const getAvailableMl = (flavorId) => {
    const server = serverInventory[flavorId] || 0;
    const reserved = getReservedInCart(flavorId);
    return Math.max(0, (server - reserved) * 10);
  };

  // ================= CENA =================
  const calculatePrice = (volume, strength, baseType) => {
    let price = 0;
    let p10 = 0,
      p60 = 0;

    if (baseType === "sól") {
      if ([6, 12, 18].includes(strength)) {
        p10 = 14.5;
        p60 = 76;
      } else {
        p10 = 15.5;
        p60 = 82;
      }
    } else {
      if ([6, 12].includes(strength)) {
        p10 = 10.5;
        p60 = 52;
      } else if (strength === 18) {
        p10 = 11.5;
        p60 = 58;
      } else if (strength === 24) {
        p10 = 12.5;
        p60 = 64;
      }
    }

    let remainder = volume;
    const num60 = Math.floor(remainder / 60);
    price += num60 * p60;
    remainder %= 60;

    const num30 = Math.floor(remainder / 30);
    if (num30 > 0) {
      const price30 = (() => {
        if (baseType === "nikotyna") {
          if ([6, 12].includes(strength)) return 31;
          if (strength === 18) return 34;
          if (strength === 24) return 37;
        } else {
          if ([6, 12, 18].includes(strength)) return 43;
          if ([24, 36].includes(strength)) return 46;
        }
        return 0;
      })();
      price += num30 * price30;
      remainder %= 30;
    }

    price += (remainder / 10) * p10;
    return price;
  };

  // ================= DODAJ =================
  const addToCart = () => {
    if (!name || !selectedFlavor || !ml || !strength || !base) {
      showMessage("❌ Uzupełnij formularz", "error");
      return;
    }

    if (ml % 10 !== 0) {
      showMessage("❌ Tylko co 10ml", "error");
      return;
    }

    const maxMl = getAvailableMl(selectedFlavor.id);
    if (ml > maxMl) {
      showMessage(`❌ Max ${maxMl}ml`, "error");
      return;
    }

    const price = calculatePrice(Number(ml), strength, base);

    setCart([
      ...cart,
      {
        flavor: selectedFlavor,
        ml: Number(ml),
        strength,
        base,
        price
      }
    ]);

    setMl("");
    showMessage("✅ Dodano do koszyka", "success");
  };

  const removeItem = (idx) =>
    setCart(cart.filter((_, i) => i !== idx));

  // ================= WYŚLIJ =================
  const sendOrder = async () => {
    if (cart.length === 0) {
      showMessage("❌ Koszyk pusty", "error");
      return;
    }

    if (isSending) return;
    setIsSending(true);

    const orderText = cart
      .map(
        (i) =>
          `${i.flavor.id}/${i.ml}ml/${i.strength}mg/${i.base}/${i.price.toFixed(
            2
          )}`
      )
      .join("\n");

    const total = cart.reduce((s, i) => s + i.price, 0);

    const usedAromas = {};
    cart.forEach((i) => {
      usedAromas[i.flavor.id] =
        (usedAromas[i.flavor.id] || 0) + i.ml / 10;
    });

    try {
      await fetch(SHEET_API, {
        method: "POST",
        body: JSON.stringify({
          name,
          orderText,
          total,
          usedAromas
        })
      });

      showMessage("✅ Zamówienie wysłane!", "success");

      const newInventory = { ...serverInventory };
      Object.entries(usedAromas).forEach(([id, used]) => {
        newInventory[id] = Math.max(
          0,
          (newInventory[id] || 0) - used
        );
      });

      setServerInventory(newInventory);
      setCart([]);
    } catch {
      showMessage("❌ Błąd wysyłki", "error");
    } finally {
      setIsSending(false);
    }
  };

  const total = cart.reduce((s, i) => s + i.price, 0);

  // ================= KATEGORIE =================
  const categoryColors = {
    "Miksy owocowe": ["#f87171", "#fecaca"],
    "Owoce leśne": ["#a78bfa", "#e9d5ff"],
    "Tropikalne/Egzotyczne": ["#facc15", "#fef08a"],
    "Cytrusy/kwaśne": ["#fde68a", "#fef9c3"],
    "Miętowe/mentholowe": ["#60a5fa", "#bfdbfe"],
    "Inne smaki": ["#34d399", "#bbf7d0"]
  };

  const flavorCategories = {
    "Miksy owocowe": [
      { id: 1, name: "Czerwone owoce, Czarna porzeczka, Truskawka, Jeżyna, Malina, Jagoda, Efekt chłodu" },
      { id: 2, name: "Czerwone owoce, Truskawka, Czarna porzeczka, Efekt lodowaty" },
      { id: 3, name: "Czerwone owoce, Jagoda, Malina, Wiśniowy, Efekt chłodu" },
      { id: 4, name: "Czerwone owoce, Ananas, Efekt lodowaty" },
      { id: 5, name: "Czerwone owoce, Mango, Efekt chłodu" },
      { id: 6, name: "Czerwone owoce, Wata cukrowa" },
      { id: 7, name: "Czerwone owoce, Jabłko, Cytryna" },
      { id: 8, name: "Czerwone owoce, Wiśniowy, Jagody, Anyż, Eukaliptus, Mentol, Efekt chłodu" },
      { id: 9, name: "Czerwone owoce, Anyż, Mentol, Efekt chłodu" },
      { id: 10, name: "Czerwone owoce, Guma do żucia, Mentol, Anyż, Efekt chłodu" },
      { id: 11, name: "Czerwone owoce, Winogrono, Anyż, Mentol, Efekt chłodu" }
    ],
    "Owoce leśne": [
      { id: 12, name: "Czarna porzeczka, Efekt chłodu" },
      { id: 13, name: "Jagody, Jabłko, Efekt chłodu" },
      { id: 14, name: "Truskawka, Malina, Czarna porzeczka, Jeżyna, Efekt chłodu" },
      { id: 15, name: "Jagoda, Czerwona porzeczka, Owoc węża, Efekt chłodu" },
      { id: 16, name: "Malina, Brzoskwinia, Cytryna, Cynamon, Efekt chłodu" },
      { id: 17, name: "Owoce leśne, Granat, Róża, Nutka świeżości" },
      { id: 18, name: "Wiśnia, Agrest czarny" },
      { id: 19, name: "Wata cukrowa, Fiołek, Jagoda, Owoce leśne, Nutka świeżości" },
      { id: 20, name: "Malina, Jagoda, Cytryna" },
      { id: 21, name: "Granat, Truskawka, Czarna porzeczka, Efekt chłodu" }
    ],
    "Tropikalne/Egzotyczne": [
      { id: 22, name: "Granat, Truskawka, Kiwi, Efekt chłodu" },
      { id: 23, name: "Granat, Truskawka, Smoczy owoc, Efekt chłodu" },
      { id: 24, name: "Arbuz, Kiwi" },
      { id: 25, name: "Arbuz, Truskawka, Granat, Efekt chłodu" },
      { id: 26, name: "Żółty owoc smoka, Melon, Arbuz, Efekt chłodu" },
      { id: 27, name: "Truskawka, Mango, Granat, Efekt chłodu" },
      { id: 28, name: "Ananas, Cytryna, Efekt chłodu" },
      { id: 29, name: "Ananas, Liczi, Efekt chłodu" },
      { id: 30, name: "Smoczy owoc, Kiwi, Guawa, Truskawka" },
      { id: 31, name: "Smoczy owoc, Truskawka, Efekt chłodu" },
      { id: 32, name: "Kokos, Banan, Kiwi" }
    ],
    "Cytrusy/kwaśne": [
      { id: 33, name: "Cytryna, Cytryna zielona, Efekt chłodu" },
      { id: 34, name: "Kwaśne cukierki, Jabłko, Efekt chłodu" },
      { id: 35, name: "Grejpfrut, Truskawka" }
    ],
    "Miętowe/mentholowe": [
      { id: 36, name: "Menthol" },
      { id: 37, name: "Mięta słodka" },
      { id: 38, name: "Mięta lodowa" }
    ],
    "Inne smaki": [
      { id: 39, name: "Granat, Truskawka, Efekt lodowaty" },
      { id: 40, name: "Wiśnia, Truskawka, Efekt chłodu" },
      { id: 41, name: "Jabłko, Gruszka, Kaktus, Efekt chłodu" },
      { id: 42, name: "Brzoskwinia, Morela, Efekt chłodu" },
      { id: 43, name: "Gruszka, Melon, Granat, Efekt chłodu" },
      { id: 44, name: "Żółte kiwi, Truskawka, Granat, Efekt chłodu" },
      { id: 45, name: "Niebieska malina, Melon, Efekt chłodu" },
      { id: 46, name: "Cola, Efekt lodowaty" },
      { id: 47, name: "Arbuz" },
      { id: 48, name: "Energetyk" },
      { id: 49, name: "Brzoskwinia" },
      { id: 50, name: "Winogrono" },
      { id: 51, name: "Winogrono, Jabłko" },
      { id: 52, name: "Herbata" },
      { id: 53, name: "Czerwone owoce, Malina, Efekt chłodu" }
    ]
  };

  // ================= RENDER =================
  return (
    <div
      style={{
        maxWidth: 520,
        margin: "40px auto",
        padding: 15,
        borderRadius: 12,
        background: `url(${bg}) center/cover`,
        boxShadow: "0 0 20px rgba(0,0,0,.2)"
      }}
    >
      <h2 style={{ textAlign: "center" }}>Mini sklep liquidów</h2>

      <input
        placeholder="Imię"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ width: "50%", marginBottom: 10 }}
      />

      <h3>Smaki</h3>
      {Object.entries(flavorCategories).map(([cat, flavors]) => {
        const [main, light] = categoryColors[cat];

        return (
          <details key={cat} style={{ background: main, marginBottom: 10 }}>
            <summary style={{ fontWeight: "bold" }}>{cat}</summary>

            {flavors.map((f) => {
              const stock = getAvailableMl(f.id);

              return (
                <div
                  key={f.id}
                  onClick={() =>
                    stock === 0
                      ? showMessage("❌ Brak na stanie", "error")
                      : setSelectedFlavor(f)
                  }
                >
                  {f.id}. {f.name} ({stock}ml)
                </div>
              );
            })}
          </details>
        );
      })}

      <h3>Ilość (ml)</h3>
      <div style={{ display: "flex", gap: 10 }}>
        <input
          type="number"
          step={10}
          min={10}
          value={ml}
          onChange={(e) => setMl(e.target.value)}
          style={{
            width: "30%",
            background: Number(ml) === 60 ? "#dcfce7" : "#fff"
          }}
        />
        <span style={{ fontSize: 12 }}>
          Przy zakupie 60ml jednego smaku cena jest bardziej korzystna
        </span>
      </div>

      <button onClick={addToCart}>➕ Dodaj do koszyka</button>

      <h3>Koszyk</h3>
      {cart.map((i, idx) => (
        <div key={idx}>
          {i.flavor.id}/{i.ml}ml/{i.strength}mg/{i.base} —{" "}
          {i.price.toFixed(2)} zł
          {i.ml === 60 && <b> BEST DEAL</b>}
          <button onClick={() => removeItem(idx)}>❌</button>
        </div>
      ))}

      <h3>Suma: {total.toFixed(2)} zł</h3>

      <button disabled={isSending} onClick={sendOrder}>
        {isSending ? "Wysyłanie..." : "📤 Wyślij zamówienie"}
      </button>
    </div>
  );
}
