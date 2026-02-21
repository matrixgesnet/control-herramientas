const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const passwordAdmin = await bcrypt.hash("admin123", 10);
  const passwordSupervisor = await bcrypt.hash("super123", 10);
  const passwordAlmacen = await bcrypt.hash("almacen123", 10);

  await prisma.user.createMany({
    data: [
      {
        name: "Admin",
        email: "admin@test.com",
        password: passwordAdmin,
      },
      {
        name: "Supervisor",
        email: "supervisor@test.com",
        password: passwordSupervisor,
      },
      {
        name: "Almacen",
        email: "almacen@test.com",
        password: passwordAlmacen,
      },
    ],
  });

  await prisma.sede.createMany({
    data: [
      { nombre: "Lima" },
      { nombre: "Piura" },
      { nombre: "Chiclayo" },
      { nombre: "Trujillo" },
    ],
  });

  console.log("✅ Seed ejecutado correctamente");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
