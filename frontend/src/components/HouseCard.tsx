import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActions from "@mui/material/CardActions";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import type { HouseSummary } from "../types/api";
import type { HouseId } from "@ravenloft/content";

export function HouseCard({
  house,
  onSelect,
}: {
  house: HouseSummary;
  onSelect: (id: HouseId) => void;
}) {
  return (
    <Card
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        opacity: house.available ? 1 : 0.6,
        transition: "border-color 120ms, transform 120ms",
        "&:hover": house.available ? { borderColor: "secondary.main" } : undefined,
      }}
    >
      <CardContent sx={{ flexGrow: 1 }}>
        <Typography variant="h3" gutterBottom>
          {house.name}
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 1 }}>
          {house.subtitle}
        </Typography>
        <Typography sx={{ fontStyle: "italic", mb: 1 }}>{house.motto}</Typography>
        <Typography variant="body2">{house.strength}</Typography>
      </CardContent>
      <CardActions sx={{ p: 2, pt: 0 }}>
        <Button
          fullWidth
          color={house.available ? "secondary" : "inherit"}
          disabled={!house.available}
          onClick={() => onSelect(house.id)}
        >
          {house.available ? "Disponível — escolher" : "Escolhida"}
        </Button>
      </CardActions>
    </Card>
  );
}
