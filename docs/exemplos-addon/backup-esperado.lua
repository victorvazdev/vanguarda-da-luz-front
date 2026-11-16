-- Resultado esperado de BackupCodec.Decode(backup.txt)
-- (docs/formato-string-backup.md). Um evento criado no jogo, uma edição de um
-- evento do site (pL5w…, de valida.txt), presenças, profissões, item level e
-- main, e tempo jogado junto. Nomes com acentos.
return {
  game = "forever",
  generatedAt = 1794420000,
  exportNumber = 1794409200,
  generatedBy = "Victor Vaz",
  events = {
    {
      id = "G7cQx2LmP9aRt4VbN1sK",
      origin = "jogo",
      title = "Treino de PvP: Vale Alterac",
      startsAt = 1794870000,
      description = "Ponto de encontro em Altaforja.\nTragam \"Poção de Cura\" | elixires.",
      organizer = "Victor Vaz",
      status = "ativo",
      updatedAt = 1794415000,
      max = 25,
      guests = false,
      by = "Victor Vaz",
    },
    {
      id = "pL5wE1dN7sA3gF6hJ0Ko",
      origin = "site",
      title = "Encontro da guilda (novo horário)",
      startsAt = 1796518800,
      description = "Conversa sobre a próxima temporada — todos são bem-vindos.",
      organizer = "Tavia",
      status = "ativo",
      updatedAt = 1794418000,
      by = "Árya Ñúñez",
    },
  },
  attendance = {
    ["3kTq9ZcV1bWfX7rLm2Pa"] = {
      ["Victor Vaz"] = { s = 1, t = 1794410000 },
      ["Dorvan Pedra"] = { s = 0, t = 1794411000 },
    },
    ["G7cQx2LmP9aRt4VbN1sK"] = {
      ["Árya Ñúñez"] = { s = 1, t = 1794416000 },
    },
  },
  professions = {
    ["Victor Vaz"] = { t = 1794400000, p = {
      { n = "Ferraria", l = 225, m = 300, i = 164 },
      { n = "Mineração", l = 230, m = 300, i = 186 },
    } },
    ["Maren Luz"] = { t = 1794300000, p = {
      { n = "Alquimia", l = 120, m = 150 },
    } },
    ["Dorvan Pedra"] = { t = 1794200000, p = {} },
  },
  members = {
    ["Victor Vaz"] = { t = 1794400000, i = 31, m = "Victor Vaz" },
    ["Victor Alt"] = { t = 1794390000, i = 12, m = "Victor Vaz" },
    ["Maren Luz"] = { t = 1794300000, i = 28 },
  },
  together = {
    ["Victor Vaz"] = 36000,
    ["Árya Ñúñez"] = 5400,
  },
}
