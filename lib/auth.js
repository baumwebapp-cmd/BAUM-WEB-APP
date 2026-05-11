import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email y contraseña son requeridos");
        }

        const usuario = await prisma.usuario.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });

        if (!usuario) {
          throw new Error("Credenciales inválidas");
        }

        if (!usuario.activo) {
          throw new Error("Usuario desactivado. Contacta al administrador");
        }

        const passwordValido = await bcrypt.compare(credentials.password, usuario.password);

        if (!passwordValido) {
          throw new Error("Credenciales inválidas");
        }

        return {
          id: String(usuario.id),
          email: usuario.email,
          name: usuario.nombre,
          rol: usuario.rol,
        };
      },
    }),
  ],

  session: {
    strategy: "jwt",
    maxAge: 60 * 30,
    updateAge: 60 * 5,
  },

  jwt: {
    maxAge: 60 * 30,
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.rol = user.rol;
        token.nombre = user.name;
      }
      return token;
    },

    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id;
        session.user.rol = token.rol;
        session.user.nombre = token.nombre;
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  secret: process.env.NEXTAUTH_SECRET,
};

export const ROLES = {
  DUENO: "DUENO",
  SUPERADMIN: "SUPERADMIN",
  GERENTE: "GERENTE",
  DISENADOR: "DISENADOR",
  COSTOS: "COSTOS",
  PRODUCCION: "PRODUCCION",
};

export function tienePermiso(rolUsuario, rolesPermitidos) {
  if (!rolUsuario) return false;
  if (!Array.isArray(rolesPermitidos)) return rolUsuario === rolesPermitidos;
  return rolesPermitidos.includes(rolUsuario);
}
