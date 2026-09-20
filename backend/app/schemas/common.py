from typing import Annotated, Optional
from pydantic import BeforeValidator


def _validate_id(v):
    if v is None:
        return None
    return str(v)


StrId = Annotated[str, BeforeValidator(_validate_id)]
OptStrId = Annotated[Optional[str], BeforeValidator(_validate_id)]
