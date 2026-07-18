import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import LockIcon from "@mui/icons-material/Lock";

export function PrivatePanel({ title, text }: { title: string; text: string }) {
  return (
    <Card
      component="section"
      aria-label={title}
      sx={{ mb: 3, borderLeft: "4px solid", borderLeftColor: "secondary.main", bgcolor: "#1e2128" }}
    >
      <CardContent>
        <Typography variant="h3" gutterBottom>
          {title}
        </Typography>
        <Chip
          size="small"
          icon={<LockIcon />}
          label="Informação privada da sua Casa"
          color="secondary"
          variant="outlined"
          sx={{ mb: 1.5 }}
        />
        {text.split("\n\n").map((para, i) => (
          <Typography key={i} sx={{ mb: 1 }}>
            {para}
          </Typography>
        ))}
      </CardContent>
    </Card>
  );
}
