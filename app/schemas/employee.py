from pydantic import BaseModel
from typing import Optional

# Employee base model, common fields
class EmployeeBase(BaseModel):
    first_name: str
    last_name: str
    job_title: Optional[str] = None

# Schema for creating a new Employee
class EmployeeCreate(EmployeeBase):
    pass

# Schema for returning Employee data
class EmployeeResponse(EmployeeBase):
    id: int

    class Config:
        from_attributes = True
