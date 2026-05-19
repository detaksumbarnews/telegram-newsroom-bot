require("dotenv").config();

const { Telegraf, Markup } = require("telegraf");

const bot = new Telegraf(process.env.BOT_TOKEN);

// ======================
// CONFIG
// ======================

const GROUP_ID = -1003769406990;

const TOPIC_UPLOAD = 3;
const TOPIC_DRAFT = 5;
const TOPIC_PUBLISH = 7;
const TOPIC_PRIVATE = 58;

const ADMIN_ID = 8702126779;

// ======================
// STORAGE
// ======================

let userState = {};
let beritaData = {};
let listBerita = [];

// ======================
// START
// ======================

bot.start((ctx) => {
  ctx.reply(
    `📰 Selamat datang di Bot Newsroom!`,
    Markup.keyboard([["📰 Buat Berita"], ["📋 List Berita"]])
      .resize()
      .extra(),
  );
});

// ======================
// LOG TOPIC
// ======================

bot.on("message", async (ctx, next) => {
  console.log(`
======================
CHAT ID:
${ctx.chat.id}

TOPIC ID:
${ctx.message.message_thread_id}
======================
`);

  return next();
});

// ======================
// MENU
// ======================

bot.hears("📰 Buat Berita", (ctx) => {
  mulaiBuatBerita(ctx);
});

bot.hears("📋 List Berita", (ctx) => {
  userState[ctx.from.id] = "list_berita";

  ctx.reply(
    `📅 Masukkan tanggal

Contoh:
20-5-26`,
  );
});

// ======================
// COMMAND
// ======================

bot.command("buatberita", (ctx) => {
  mulaiBuatBerita(ctx);
});

bot.command("listberita", (ctx) => {
  userState[ctx.from.id] = "list_berita";

  ctx.reply(
    `📅 Masukkan tanggal

Contoh:
20-5-26`,
  );
});

bot.command("id", (ctx) => {
  ctx.reply(`🆔 ID: ${ctx.from.id}`);
});

// ======================
// CLEAR CHAT
// ======================

bot.command("clearchat", async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) {
    return ctx.reply("❌ Hanya owner!");
  }

  await ctx.reply(`🧹 Membersihkan topic...`);

  for (let i = ctx.message.message_id; i >= 1; i--) {
    try {
      await bot.telegram.deleteMessage(GROUP_ID, i);
    } catch {}
  }

  ctx.reply("✅ Topic dibersihkan!");
});

// ======================
// MULAI BERITA
// ======================

async function mulaiBuatBerita(ctx) {
  const userId = ctx.from.id;

  if (!ctx.from.username) {
    return ctx.reply(
      `❌ Buat username Telegram dulu!

Settings → Username`,
    );
  }

  beritaData[userId] = {
    reporter: ctx.from.username,
    botMessages: [],
  };

  userState[userId] = "judul";

  const msg = await bot.telegram.sendMessage(
    GROUP_ID,
    "✍️ Masukkan Judul Berita:",
    {
      message_thread_id: TOPIC_UPLOAD,
    },
  );

  ctx.reply("➡️ Silakan lanjut isi detail berita di Topic Upload.");

  beritaData[userId].botMessages.push(msg.message_id);
}

// ======================
// TEXT
// ======================

bot.on("text", async (ctx) => {
  const userId = ctx.from.id;

  // ======================
  // LIST BERITA
  // ======================

  if (userState[userId] === "list_berita") {
    const tanggal = ctx.message.text;

    const hasil = listBerita.filter((x) => x.tanggal === tanggal);

    if (hasil.length < 1) {
      userState[userId] = null;

      return ctx.reply(`❌ Tidak ada berita tanggal ${tanggal}`);
    }

    let text = `📰 LIST BERITA ${tanggal}

`;

    hasil.forEach((b, i) => {
      text += `${i + 1}. ${b.judul}
👤 @${b.reporter}
📌 ${b.status}

`;
    });

    userState[userId] = null;

    return ctx.reply(text);
  }

  // ======================
  // JUDUL
  // ======================

  if (userState[userId] === "judul") {
    beritaData[userId].judul = ctx.message.text;

    await ctx.deleteMessage();

    userState[userId] = "foto";

    const msg = await bot.telegram.sendMessage(
      GROUP_ID,
      "📸 Upload Foto atau Video:",
      {
        message_thread_id: TOPIC_UPLOAD,
      },
    );

    beritaData[userId].botMessages.push(msg.message_id);

    return;
  }

  // ======================
  // ISI
  // ======================

  if (userState[userId] === "isi") {
    beritaData[userId].isi = ctx.message.text;

    await ctx.deleteMessage();

    userState[userId] = "jadwal";

    const msg = await bot.telegram.sendMessage(
      GROUP_ID,
      `⏰ Masukkan Jadwal

Contoh:
20-5-26 17:00`,
      { message_thread_id: TOPIC_UPLOAD },
    );

    beritaData[userId].botMessages.push(msg.message_id);

    return;
  }

  // ======================
  // JADWAL
  // ======================

  if (userState[userId] === "jadwal") {
    beritaData[userId].jadwal = ctx.message.text + " WIB";

    beritaData[userId].tanggal = ctx.message.text.split(" ")[0];

    await ctx.deleteMessage();

    userState[userId] = null;

    return tampilPreview(ctx, userId);
  }

  // ======================
  // EDIT JUDUL
  // ======================

  if (userState[userId] === "edit_judul") {
    beritaData[userId].judul = ctx.message.text;

    await ctx.deleteMessage();

    userState[userId] = null;

    return tampilPreview(ctx, userId);
  }

  // ======================
  // EDIT ISI
  // ======================

  if (userState[userId] === "edit_isi") {
    beritaData[userId].isi = ctx.message.text;

    await ctx.deleteMessage();

    userState[userId] = null;

    return tampilPreview(ctx, userId);
  }

  // ======================
  // EDIT JADWAL
  // ======================

  if (userState[userId] === "edit_jadwal") {
    beritaData[userId].jadwal = ctx.message.text + " WIB";

    beritaData[userId].tanggal = ctx.message.text.split(" ")[0];

    await ctx.deleteMessage();

    userState[userId] = null;

    return tampilPreview(ctx, userId);
  }
});

// ======================
// FOTO
// ======================

bot.on(["photo", "video", "animation"], async (ctx) => {
  const userId = ctx.from.id;
  if (!userState[userId]) return;

  let fileId;
  let type;

  if (ctx.message.photo) {
    fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    type = "photo";
  } else if (ctx.message.video) {
    fileId = ctx.message.video.file_id;
    type = "video";
  } else if (ctx.message.animation) {
    fileId = ctx.message.animation.file_id;
    type = "animation";
  }

  // FOTO
  if (userState[userId] === "foto") {
    beritaData[userId].foto = fileId;
    beritaData[userId].mediaType = type;

    await ctx.deleteMessage();
    userState[userId] = "isi";
    const msg = await bot.telegram.sendMessage(
      GROUP_ID,
      "📝 Masukkan Isi Berita:",
      {
        message_thread_id: TOPIC_UPLOAD,
      },
    );

    beritaData[userId].botMessages.push(msg.message_id);
    return;
  }

  // EDIT FOTO
  if (userState[userId] === "edit_foto") {
    beritaData[userId].foto = fileId;
    beritaData[userId].mediaType = type;

    await ctx.deleteMessage();
    userState[userId] = null;
    return tampilPreview(ctx, userId);
  }
});

// ======================
// PREVIEW
// ======================

async function tampilPreview(ctx, userId) {
  const data = beritaData[userId];

  const caption = `👤 Reporter: @${data.reporter}\n\n📰 ${data.judul}\n\n⏰ Jadwal: ${data.jadwal}`;
  let mediaMsg;

  // Kirim sesuai jenis media
  if (data.mediaType === "video") {
    mediaMsg = await bot.telegram.sendVideo(GROUP_ID, data.foto, {
      caption: caption,
      message_thread_id: TOPIC_UPLOAD,
    });
  } else if (data.mediaType === "animation") {
    mediaMsg = await bot.telegram.sendAnimation(GROUP_ID, data.foto, {
      caption: caption,
      message_thread_id: TOPIC_UPLOAD,
    });
  } else {
    mediaMsg = await bot.telegram.sendPhoto(GROUP_ID, data.foto, {
      caption: caption,
      message_thread_id: TOPIC_UPLOAD,
    });
  }

  const isi = await bot.telegram.sendMessage(GROUP_ID, `📝 ${data.isi}`, {
    message_thread_id: TOPIC_UPLOAD,
  });

  const tombol = await bot.telegram.sendMessage(
    GROUP_ID,
    "Masih mau edit?",
    Markup.inlineKeyboard([
      [
        Markup.callbackButton("Edit Judul", "edit_judul"),

        Markup.callbackButton("Edit Foto", "edit_foto"),
      ],

      [
        Markup.callbackButton("Edit Isi", "edit_isi"),

        Markup.callbackButton("Edit Jadwal", "edit_jadwal"),
      ],

      [Markup.callbackButton("✅ Submit", "submit")],
    ]).extra({ message_thread_id: TOPIC_UPLOAD }),
  );

  beritaData[userId].preview = [
    mediaMsg.message_id,
    isi.message_id,
    tombol.message_id,
  ];
}

// ======================
// EDIT
// ======================

bot.action("edit_judul", (ctx) => {
  userState[ctx.from.id] = "edit_judul";

  bot.telegram.sendMessage(GROUP_ID, "✍️ Kirim Judul Baru:", {
    message_thread_id: TOPIC_UPLOAD,
  });
});

bot.action("edit_foto", (ctx) => {
  userState[ctx.from.id] = "edit_foto";

  bot.telegram.sendMessage(GROUP_ID, "📸 Upload Foto/Video Baru:", {
    message_thread_id: TOPIC_UPLOAD,
  });
});

bot.action("edit_isi", (ctx) => {
  userState[ctx.from.id] = "edit_isi";

  bot.telegram.sendMessage(GROUP_ID, "📝 Kirim Isi Baru:", {
    message_thread_id: TOPIC_UPLOAD,
  });
});

bot.action("edit_jadwal", (ctx) => {
  userState[ctx.from.id] = "edit_jadwal";

  bot.telegram.sendMessage(
    GROUP_ID,
    `⏰ Kirim Jadwal Baru

Contoh:
20-5-26 17:00`,
    { message_thread_id: TOPIC_UPLOAD },
  );
});

// ======================
// SUBMIT
// ======================

bot.action("submit", async (ctx) => {
  const userId = ctx.from.id;
  const data = beritaData[userId];
  if (!data)
    return ctx.answerCbQuery("❌ Data kadaluarsa, silakan buat ulang.");

  const extra = {
    message_thread_id: TOPIC_DRAFT,
    caption: `👤 Reporter: @${data.reporter}\n\n📰 ${data.judul}\n\n⏰ Jadwal: ${data.jadwal}`,
  };

  let fotoDraft;
  if (data.mediaType === "video") {
    fotoDraft = await bot.telegram.sendVideo(GROUP_ID, data.foto, extra);
  } else if (data.mediaType === "animation") {
    fotoDraft = await bot.telegram.sendAnimation(GROUP_ID, data.foto, extra);
  } else {
    fotoDraft = await bot.telegram.sendPhoto(GROUP_ID, data.foto, extra);
  }

  // ISI
  const isiDraft = await bot.telegram.sendMessage(GROUP_ID, `📝 ${data.isi}`, {
    message_thread_id: TOPIC_DRAFT,
  });

  // UPDATE BUTTONS (Inject IDs after initialization)
  await bot.telegram.editMessageReplyMarkup(
    GROUP_ID,
    isiDraft.message_id,
    undefined,
    {
      inline_keyboard: [
        [
          {
            text: "🌍 Publish",
            callback_data: `publish_${fotoDraft.message_id}_${isiDraft.message_id}`,
          },
        ],
        [
          {
            text: "🗑 Hapus",
            callback_data: `hapusdraft_${fotoDraft.message_id}_${isiDraft.message_id}`,
          },
        ],
      ],
    },
  );

  // LIST
  listBerita.push({
    judul: data.judul,
    reporter: data.reporter,
    tanggal: data.tanggal,
    status: "Draft",
  });

  // HAPUS PREVIEW
  for (const id of data.preview) {
    try {
      await bot.telegram.deleteMessage(GROUP_ID, id);
    } catch {}
  }

  delete beritaData[userId];
  delete userState[userId];

  await bot.telegram.sendMessage(GROUP_ID, "✅ Berita masuk Draft!", {
    message_thread_id: TOPIC_UPLOAD,
  });
});

// ======================
// PUBLISH
// ======================

bot.action(/publish_(.+)/, async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) {
    return ctx.answerCbQuery("❌ Hanya owner!", { show_alert: true });
  }

  const data = ctx.match[1].split("_");
  const fotoId = Number(data[0]);
  const isiId = Number(data[1]);

  // FOTO KE PUBLISH
  const resFoto = await bot.telegram.copyMessage(GROUP_ID, GROUP_ID, fotoId, {
    message_thread_id: TOPIC_PUBLISH,
  });

  // ISI KE PUBLISH
  const resIsi = await bot.telegram.sendMessage(
    GROUP_ID,
    ctx.callbackQuery.message.text,
    {
      message_thread_id: TOPIC_PUBLISH,
    },
  );

  // UPDATE BUTTONS FOR PUBLISH (Pass new IDs for next step)
  await bot.telegram.editMessageReplyMarkup(
    GROUP_ID,
    resIsi.message_id,
    undefined,
    {
      inline_keyboard: [
        [
          {
            text: "🔒 Privatkan",
            callback_data: `privat_${resFoto.message_id}_${resIsi.message_id}`,
          },
        ],
        [
          {
            text: "🗑 Hapus",
            callback_data: `hapuspublish_${resFoto.message_id}_${resIsi.message_id}`,
          },
        ],
      ],
    },
  );

  // HAPUS DRAFT
  try {
    await bot.telegram.deleteMessage(GROUP_ID, fotoId);
  } catch {}

  try {
    await bot.telegram.deleteMessage(GROUP_ID, isiId);
  } catch {}

  ctx.answerCbQuery("✅ Dipublish!");
});

// ======================
// PRIVAT
// ======================

bot.action(/privat_(.+)/, async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) {
    return ctx.answerCbQuery("❌ Hanya owner!", { show_alert: true });
  }

  const data = ctx.match[1].split("_");
  const fotoId = Number(data[0]);
  const isiId = Number(data[1]);

  // FOTO KE PRIVATE
  const resFoto = await bot.telegram.copyMessage(GROUP_ID, GROUP_ID, fotoId, {
    message_thread_id: TOPIC_PRIVATE,
  });

  // ISI KE PRIVATE
  const resIsi = await bot.telegram.sendMessage(
    GROUP_ID,
    ctx.callbackQuery.message.text,
    {
      message_thread_id: TOPIC_PRIVATE,
    },
  );

  // UPDATE BUTTONS FOR PRIVATE
  await bot.telegram.editMessageReplyMarkup(
    GROUP_ID,
    resIsi.message_id,
    undefined,
    {
      inline_keyboard: [
        [
          {
            text: "🗑 Hapus",
            callback_data: `hapusprivate_${resFoto.message_id}_${resIsi.message_id}`,
          },
        ],
      ],
    },
  );

  // HAPUS PUBLISH
  try {
    await bot.telegram.deleteMessage(GROUP_ID, fotoId);
  } catch {}

  try {
    await bot.telegram.deleteMessage(GROUP_ID, isiId);
  } catch {}

  ctx.answerCbQuery("🔒 Diprivatkan!");
});

// ======================
// HAPUS DRAFT
// ======================

bot.action(/hapusdraft_(.+)/, async (ctx) => {
  const data = ctx.match[1].split("_");

  const fotoId = Number(data[0]);

  const isiId = Number(data[1]);

  try {
    await bot.telegram.deleteMessage(GROUP_ID, fotoId);
  } catch {}

  try {
    await bot.telegram.deleteMessage(GROUP_ID, isiId);
  } catch {}

  ctx.answerCbQuery("🗑 Draft dihapus!");
});

// ======================
// HAPUS PUBLISH
// ======================

bot.action(/hapuspublish_(.+)/, async (ctx) => {
  const data = ctx.match[1].split("_");

  const fotoId = Number(data[0]);

  const isiId = Number(data[1]);

  try {
    await bot.telegram.deleteMessage(GROUP_ID, fotoId);
  } catch {}

  try {
    await bot.telegram.deleteMessage(GROUP_ID, isiId);
  } catch {}

  ctx.answerCbQuery("🗑 Publish dihapus!");
});

// ======================
// HAPUS PRIVATE
// ======================

bot.action(/hapusprivate_(.+)/, async (ctx) => {
  const data = ctx.match[1].split("_");

  const fotoId = Number(data[0]);

  const isiId = Number(data[1]);

  try {
    await bot.telegram.deleteMessage(GROUP_ID, fotoId);
  } catch {}

  try {
    await bot.telegram.deleteMessage(GROUP_ID, isiId);
  } catch {}

  ctx.answerCbQuery("🗑 Private dihapus!");
});

// ======================
// RUN
// ======================

bot.launch();

console.log("🔥 Bot Newsroom jalan...");
