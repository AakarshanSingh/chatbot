import asyncio
import uuid
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.models.user import User
from app.utils.security import hash_password
from app.config import settings


async def seed():
    engine = create_async_engine(settings.database_url, echo=True)
    async_session = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with async_session() as session:
        admin = User(
            id=uuid.uuid4(),
            name="System Admin",
            email="admin@support.com",
            password_hash=hash_password("password123"),
            role="admin",
            is_online=False,
        )
        session.add(admin)

        for i in range(1, 6):
            staff = User(
                id=uuid.uuid4(),
                name=f"Support Staff {i }",
                email=f"staff{i }@support.com",
                password_hash=hash_password("password123"),
                role="staff",
                is_online=False,
            )
            session.add(staff)

        await session.commit()
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
