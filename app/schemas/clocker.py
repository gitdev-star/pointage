from pydantic import BaseModel
from typing import Optional

# User base model, common fields
class UserBase(BaseModel):
    username: str
    email: Optional[str] = None

# Schema for creating a new User
class UserCreate(UserBase):
    password: str

# Schema for returning a User as a response
class UserResponse(UserBase):
    id: int

    class Config:
        from_attributes = True  # Tells Pydantic to treat ORM models as dictionaries
